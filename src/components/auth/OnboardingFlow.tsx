import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';
import {
  DotMatrixPattern,
  GeometricGoldCube,
  GeometricRavenCrest,
} from '../brand/VectorMotifs';
import {
  TABRIX_PAGE_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixDirection,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 'command',
    badge: 'الجيل الجديد لإدارة الوكالات',
    title: 'قيادة ذكية للوكالات والحصص',
    subtitle:
      'منصة تنفيذية موحدة بتصميم الأعماق البحرية ثلاثي الأبعاد لمتابعة المستفيدين، احتساب الكميات والأجور تلقائياً، وإصدار الكشوف الدقيقة بثوانٍ.',
    metric: 'دقة محاسبية فورية · واجهة بحرية زجاجية 3D',
    visual: 'cube' as const,
  },
  {
    id: 'compression',
    badge: 'محرك الضغط المسبق',
    title: 'ضغط تلقائي قبل الحفظ يوفر حتى 80%',
    subtitle:
      'كل سجل وصورة تُضغط وتُحسّن تلقائياً إلى WebP وحزم Gzip فائقة السرعة قبل دخول المخزن، لتبقى المساحة خفيفة مهما كبرت الكشوف.',
    metric: 'توفير ذكي للمساحة · حفظ لحظي وموثوق',
    visual: 'compression' as const,
  },
  {
    id: 'isolation',
    badge: 'خصوصية متعددة العملاء',
    title: 'عزل تام لكل حساب وبياناته',
    subtitle:
      'كل مستخدم يمتلك مساحته المعزولة الخاصة تحت معرّفه الفريد بدون أي تداخل أو تسرب بين الحسابات، مع انتقال سلس عند تبديل الجلسة.',
    metric: 'عزل صارم per-UID · حماية متكاملة',
    visual: 'crest' as const,
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const reducedMotion = useTabrixReducedMotion();
  const slideDir = useTabrixDirection(stepIndex, (prev, next) =>
    next >= prev ? 1 : -1
  );
  const current = SLIDES[stepIndex];
  const isLast = stepIndex === SLIDES.length - 1;
  const progressPct = ((stepIndex + 1) / SLIDES.length) * 100;

  return (
    <div
      dir="rtl"
      className="ambient-obsidian-canvas fixed inset-0 z-[140] flex min-h-[100dvh] items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="ambient-orb-gold ambient-orb-gold-1" />
      <div className="ambient-orb-gold ambient-orb-gold-2" />

      <div className="relative z-10 w-full max-w-2xl my-auto">
        <div className="chamfered-glass-card smoked-glass-elevated p-6 sm:p-10 relative overflow-hidden">
          {/* Subtle dot-matrix corner */}
          <div className="pointer-events-none absolute top-0 left-0 w-44 h-44 opacity-25">
            <DotMatrixPattern />
          </div>

          {/* Top Bar: Brand + Skip */}
          <div className="relative z-10 flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <GeometricRavenCrest size={40} />
              <div>
                <span className="font-mono-num text-[11px] tracking-[0.2em] uppercase text-[var(--accent)] block">
                  MORROW SYSTEM
                </span>
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  التهيئة التنفيذية للنظام
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-white/[0.03] hover:bg-[var(--bg-nav-active)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              تخطي المقدمة
            </button>
          </div>

          {/* Marine Luminous Progress Bar */}
          <div className="relative z-10 mb-8">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)] mb-2">
              <span>{current.badge}</span>
              <span className="font-mono-num text-[var(--accent-bright)]">
                0{stepIndex + 1} / 0{SLIDES.length}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--accent-deep) 0%, var(--accent) 55%, var(--accent-bright) 100%)',
                  boxShadow: '0 0 14px var(--marine-caustic-1)',
                }}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Animated Slide Body */}
          <div className="tabrix-3d-stage">
            <AnimatePresence mode="wait" custom={slideDir} initial={false}>
              <motion.div
                key={current.id}
                custom={slideDir}
                variants={
                  reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_PAGE_VARIANTS
                }
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center py-2"
              >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-nav-active)] text-[11px] font-semibold text-[var(--accent-bright)]">
                  <Sparkles size={13} className="text-[var(--accent)]" />
                  <span>{current.metric}</span>
                </div>

                <h1 className="font-display-ar text-2xl sm:text-3xl font-bold leading-snug text-[var(--text-primary)]">
                  {current.title}
                </h1>

                <p className="text-sm sm:text-[15px] leading-relaxed text-[var(--text-muted)]">
                  {current.subtitle}
                </p>
              </div>

              <div className="flex items-center justify-center p-4 rounded-2xl border border-[var(--border-color)] bg-black/30 min-w-[144px] min-h-[144px]">
                {current.visual === 'cube' && <GeometricGoldCube size={108} />}
                {current.visual === 'compression' && (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-16 h-16 rounded-2xl border border-[var(--accent)]/40 bg-[var(--bg-nav-active)] flex items-center justify-center">
                      <Database size={30} className="text-[var(--accent-bright)]" />
                    </div>
                    <span className="font-mono-num text-sm font-bold text-[var(--accent-bright)]">
                      -75% SIZE
                    </span>
                  </div>
                )}
                {current.visual === 'crest' && (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <GeometricRavenCrest size={78} />
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <ShieldCheck size={13} />
                      <span>عزل تام لكل مستخدم</span>
                    </span>
                  </div>
                )}
              </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <div className="relative z-10 mt-8 pt-5 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`الانتقال إلى الشريحة ${idx + 1}`}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === stepIndex
                      ? 'w-7 bg-[var(--accent)]'
                      : 'w-2 bg-white/20 hover:bg-white/35'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#F4F4F6] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowRight size={14} />
                  <span>السابق</span>
                </button>
              )}

              <motion.button
                type="button"
                whileHover={reducedMotion ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                transition={TABRIX_TACTILE_SPRING}
                onClick={() => {
                  if (isLast) {
                    onComplete();
                  } else {
                    setStepIndex((prev) => prev + 1);
                  }
                }}
                className="obsidian-gold-cta px-6 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>{isLast ? 'بدء تسجيل الدخول' : 'التالي'}</span>
                <ArrowLeft size={15} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
