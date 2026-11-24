import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Edit3,
  Mic,
  Radio,
  ShieldAlert,
  StickyNote,
  Volume2,
} from 'lucide-react';
import {
  buildPermissionRecoveryGuide,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../../utils/mediaPermissions';
import { MorrowSubPageHeader } from './MorrowSubPageHeader';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface MorrowVoiceSettingsPageProps {
  voiceTargetMode: 'instruction' | 'quick_note' | 'draft_text';
  onChangeVoiceTargetMode: (mode: 'instruction' | 'quick_note' | 'draft_text') => void;
  speechSupported: boolean;
  onStartLiveCall: () => void;
  onStartVoiceNote: () => void;
  onBackToChat: () => void;
}

export const MorrowVoiceSettingsPage: React.FC<MorrowVoiceSettingsPageProps> = ({
  voiceTargetMode,
  onChangeVoiceTargetMode,
  speechSupported,
  onStartLiveCall,
  onStartVoiceNote,
  onBackToChat,
}) => {
  const [micCheckState, setMicCheckState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [micGuide, setMicGuide] = useState<MediaPermissionGuide | null>(null);
  const reducedMotion = useTabrixReducedMotion();
  const statusVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;

  const handleTestMicrophone = async () => {
    setMicCheckState('checking');
    setMicGuide(null);
    const res = await requestMicrophonePermission();
    if (res.ok) {
      setMicCheckState('ok');
    } else {
      setMicCheckState('error');
      setMicGuide(res.guide || buildPermissionRecoveryGuide('microphone'));
    }
  };

  const targetModes: Array<{
    id: 'instruction' | 'quick_note' | 'draft_text';
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'instruction',
      label: 'تنفيذ مباشر كأمر ذكي',
      desc: 'يُفرّغ الصوت ويرسله مباشرة إلى Morrow لتنفيذ الطلب أو التحليل.',
      icon: <Mic className="h-4 w-4" />,
    },
    {
      id: 'quick_note',
      label: 'حفظ كملاحظة سريعة وربطها بالعائلة',
      desc: 'يحفظ التفريغ في سجل الملاحظات السريعة ويربطه تلقائياً بالمستفيد المذكور.',
      icon: <StickyNote className="h-4 w-4" />,
    },
    {
      id: 'draft_text',
      label: 'إدراج في مربع الكتابة للمراجعة',
      desc: 'يحوّل الكلام إلى نص قابل للتعديل قبل الإرسال النهائي.',
      icon: <Edit3 className="h-4 w-4" />,
    },
  ];

  return (
    <main
      aria-label="إعدادات المحادثة المباشرة والصوت"
      data-testid="morrow-voice-settings-page"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
    >
      <MorrowSubPageHeader
        title="إعدادات المحادثة المباشرة والصوت"
        subtitle="ضبط وجهة الرسائل الصوتية، اختبار الميكروفون، وبدء جلسة البث الصوتي الحي"
        onBack={onBackToChat}
      />

      <div className="space-y-6">
        {/* Live Call Launch Card */}
        <section
          className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-5"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
          }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: '#10B981' }}>
              <Radio className="h-4 w-4 shrink-0" />
              <span>المحادثة الصوتية والمرئية المباشرة (Gemini Live)</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              تحدث مع Morrow لحظياً بصوت طبيعي ثنائي الاتجاه مع إمكانية مشاركة الكاميرا وتنفيذ أدوات الجدول مباشرة.
            </p>
          </div>

          <motion.button
            type="button"
            onClick={onStartLiveCall}
            whileHover={reducedMotion ? undefined : { y: -1.5, scale: 1.01 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            transition={TABRIX_TACTILE_SPRING}
            className="nexus-pill-btn inline-flex h-11 items-center gap-2 px-5 text-xs font-extrabold whitespace-nowrap"
            style={{
              backgroundColor: '#10B981',
              color: '#04271D',
            }}
          >
            <Radio className="h-4 w-4" />
            <span>بدء المحادثة المباشرة الآن</span>
          </motion.button>
        </section>

        {/* Default Voice Note Destination */}
        <section className="nexus-squircle p-5 space-y-3">
          <div>
            <h2 className="text-sm font-extrabold">وجهة الملاحظة الصوتية عند الإيقاف</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              حدد السلوك الافتراضي عند الضغط على زر الميكروفون في شريط الإدخال.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {targetModes.map((mode) => {
              const active = voiceTargetMode === mode.id;
              return (
                <motion.button
                  key={mode.id}
                  type="button"
                  onClick={() => onChangeVoiceTargetMode(mode.id)}
                  whileHover={reducedMotion ? undefined : { y: -2 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                  transition={TABRIX_TACTILE_SPRING}
                  className="flex flex-col gap-2 rounded-2xl border p-4 text-right transition-colors hover:border-[var(--accent-ai)]"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-main)',
                    borderColor: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                  }}
                >
                  <div
                    className="flex items-center gap-2 text-xs font-extrabold"
                    style={{ color: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)' }}
                  >
                    {mode.icon}
                    <span>{mode.label}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {mode.desc}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Microphone Check & Speech Engine Status */}
        <section className="nexus-squircle p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                <Volume2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>فحص الميكروفون والتفريغ الصوتي</span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                محرك التفريغ: Groq Whisper Turbo مع احتياط Gemini · التعرف الفوري في المتصفح:{' '}
                {speechSupported ? 'مدعوم' : 'سحابي عند التسجيل'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleTestMicrophone()}
                disabled={micCheckState === 'checking'}
                className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 border px-4 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Mic className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>{micCheckState === 'checking' ? 'جاري الفحص...' : 'اختبار إذن الميكروفون'}</span>
              </button>

              <button
                type="button"
                onClick={onStartVoiceNote}
                className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 px-4 text-xs font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent-ai, #5B4FE9)',
                  color: '#FFFFFF',
                }}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>بدء تسجيل صوتي الآن</span>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {micCheckState === 'ok' && (
              <motion.div
                key="mic-check-ok"
                variants={statusVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  borderColor: 'var(--success)',
                  color: 'var(--success)',
                }}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>الميكروفون جاهز ومصرّح به للعمل في الرسائل الصوتية والمحادثة المباشرة.</span>
              </motion.div>
            )}

            {micCheckState === 'error' && micGuide && (
              <motion.div
                key="mic-check-error"
                variants={statusVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="rounded-2xl border p-4 space-y-2 text-xs"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  borderColor: 'var(--warning)',
                }}
              >
                <div className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--warning)' }}>
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{micGuide.title}</span>
                </div>
                <p style={{ color: 'var(--text-primary)' }}>{micGuide.reason}</p>
                <ul className="list-disc pr-5 space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {micGuide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
};
