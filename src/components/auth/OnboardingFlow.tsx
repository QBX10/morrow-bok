import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';
import {
  DotMatrixPattern,
  GeometricGoldCube,
  GeometricRavenCrest,
} from '../brand/VectorMotifs';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 'command',
    badge: 'الجيل الجديد لإدارة الوكالات',
    title: 'قيادة ذكية للوكالات والحصص',
    subtitle:
      'منصة تنفيذية موحدة بتصميم السبج والذهب لمتابعة المستفيدين، احتساب الكميات والأجور تلقائياً، وإصدار الكشوف الدقيقة بثوانٍ.',
    metric: 'دقة محاسبية فورية · واجهة زجاجية فاخرة',
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
                <span className="font-mono-num text-[11px] tracking-[0.2em] uppercase text-[#D4AF37] block">
                  MORROW SYSTEM
                </span>
                <span className="text-xs font-semibold text-[#9898AA]">
                  التهيئة التنفيذية للنظام
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="px-3.5 py-2 rounded-xl border border-[#D4AF37]/25 bg-white/[0.03] hover:bg-[#D4AF37]/15 text-xs font-semibold text-[#F4F4F6] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              تخطي المقدمة
            </button>
          </div>

          {/* Golden Progress Bar */}
          <div className="relative z-10 mb-8">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#9898AA] mb-2">
              <span>{current.badge}</span>
              <span className="font-mono-num text-[#F3E5AB]">
                0{stepIndex + 1} / 0{SLIDES.length}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #D4AF37 0%, #F3E5AB 100%)',
                  boxShadow: '0 0 14px rgba(212, 175, 55, 0.55)',
                }}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Animated Slide Body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center py-2"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[11px] font-semibold text-[#F3E5AB]">
                  <Sparkles size={13} className="text-[#D4AF37]" />
                  <span>{current.metric}</span>
                </div>

                <h1 className="font-display-ar text-2xl sm:text-3xl font-bold leading-snug text-[#F4F4F6]">
                  {current.title}
                </h1>

                <p className="text-sm sm:text-[15px] leading-relaxed text-[#A1A1B5]">
                  {current.subtitle}
                </p>
              </div>

              <div className="flex items-center justify-center p-4 rounded-2xl border border-[#D4AF37]/20 bg-black/35 min-w-[144px] min-h-[144px]">
                {current.visual === 'cube' && <GeometricGoldCube size={108} />}
                {current.visual === 'compression' && (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-16 h-16 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 flex items-center justify-center">
                      <Database size={30} className="text-[#F3E5AB]" />
                    </div>
                    <span className="font-mono-num text-sm font-bold text-[#F3E5AB]">
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

          {/* Navigation Controls */}
          <div className="relative z-10 mt-8 pt-5 border-t border-[#D4AF37]/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`الانتقال إلى الشريحة ${idx + 1}`}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === stepIndex
                      ? 'w-7 bg-[#D4AF37]'
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

              <button
                type="button"
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
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
