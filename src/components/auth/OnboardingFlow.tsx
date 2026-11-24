import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Building2,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DotMatrixPattern, GeometricRavenCrest } from '../brand/VectorMotifs';
import { GradientMeshBackdrop } from '../spatial3d/GradientMeshBackdrop';
import { MorrowMascot3D } from '../spatial3d/MorrowMascot3D';
import { Spatial3DCanvas } from '../spatial3d/Spatial3DCanvas';
import { GlassBentoCard, RecessedChannelWell } from '../spatial3d/SpatialPrimitives';
import {
  TABRIX_PAGE_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixDirection,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import type { Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';

interface OnboardingFlowProps {
  onComplete: () => void;
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
}

const SLIDES = [
  {
    id: 'welcome',
    badge: 'مرحباً بك في Morrow',
    title: 'أهلاً بكم في عالم Morrow الذكي',
    subtitle:
      'منصة متكاملة وتفاعلية لقيادة الوكالات، متابعة الحصص والأفراد، وتنظيم السجلات والحسابات بسرعة وأناقة فائقة.',
    metric: 'تصميم هندسي ثلاثي الأبعاد · تفاعل حي',
    icon: Sparkles,
    highlights: [
      { label: 'إدارة الوكالات', value: 'توزيع وحصص', icon: Building2 },
      { label: 'التصميم التفاعلي', value: 'فضاء 3D ذكي', icon: Layers },
      { label: 'الأداء الفوري', value: 'استجابة لحظية', icon: TrendingUp },
    ],
  },
  {
    id: 'smart_models',
    badge: 'النماذج والتحليلات الذكية',
    title: 'تدقيق وتنبؤ ذكي للوكالات والبيانات',
    subtitle:
      'تحليل فوري للفروقات، كشف التكرارات والملاحظات تلقائياً، وإعداد خطط توزيع وتقارير دقيقة خلال ثوانٍ.',
    metric: '4 نماذج تحليل متخصصة · نتائج فورية',
    icon: BrainCircuit,
    highlights: [
      { label: 'كشف الفروقات', value: 'تدقيق تلقائي', icon: BrainCircuit },
      { label: 'توقع الحصص', value: 'تخطيط ذكي', icon: TrendingUp },
      { label: 'تقارير جاهزة', value: 'نسخ وتصدير', icon: Layers },
    ],
  },
  {
    id: 'access',
    badge: 'طرق دخول متعددة وآمنة',
    title: 'دخول مرن بالطريقة التي تناسبك',
    subtitle:
      'سجّل دخولك عبر حساب Google أو اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني بخصوصية تامة لكل حساب.',
    metric: 'Google · اسم المستخدم · الهاتف · البريد الإلكتروني',
    icon: KeyRound,
    highlights: [
      { label: 'طرق الدخول', value: '4 خيارات مرنة', icon: KeyRound },
      { label: 'الخصوصية', value: 'حسابات معزولة', icon: ShieldCheck },
      { label: 'تخصيص الألوان', value: '6 ثيمات + حر', icon: Sparkles },
    ],
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  themeId = 'emerald_smoked',
  spatialPrefs,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const reducedMotion = useTabrixReducedMotion();
  const slideDir = useTabrixDirection(stepIndex, (prev, next) =>
    next >= prev ? 1 : -1
  );
  const current = SLIDES[stepIndex];
  const isLast = stepIndex === SLIDES.length - 1;
  const progressPct = ((stepIndex + 1) / SLIDES.length) * 100;
  const CurrentIcon = current.icon;

  return (
    <div
      dir="rtl"
      className="ambient-obsidian-canvas fixed inset-0 z-[140] flex min-h-[100dvh] items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Layer 0: Framer Motion Animated Gradient Mesh & Architectural Grid */}
      <GradientMeshBackdrop
        themeId={themeId}
        spatialPrefs={spatialPrefs}
        slideIndex={stepIndex}
        intensity="vibrant"
        reduceMotion={reducedMotion}
      />

      {/* Layer 1: Three.js Sacred Geometry Astrolabe & Depth Lattice */}
      <Spatial3DCanvas
        themeId={themeId}
        spatialPrefs={spatialPrefs}
        reduceMotion={reducedMotion}
      />

      <motion.div
        className="relative z-10 w-full max-w-4xl my-auto tabrix-3d-stage"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: 4, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassBentoCard
          elevated
          tiltIntensity="subtle"
          className="p-5 sm:p-8 lg:p-10"
          testId="onboarding-3d-stage"
        >
          <div className="pointer-events-none absolute top-0 left-0 w-44 h-44 opacity-20">
            <DotMatrixPattern />
          </div>

          {/* Top Bar: Morrow Brand Crest + Skip */}
          <div className="relative z-10 flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3.5">
              <motion.div
                whileHover={reducedMotion ? undefined : { rotateY: 16, scale: 1.05 }}
                transition={TABRIX_TACTILE_SPRING}
                className="w-12 h-12 rounded-2xl border bg-black/40 flex items-center justify-center shadow-[0_0_26px_var(--spatial-glow)]"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <GeometricRavenCrest size={38} />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono-num text-sm font-black tracking-[0.18em]"
                    style={{ color: 'var(--accent-bright)' }}
                  >
                    Morrow
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-muted)]">
                    · منصة الإدارة الذكية
                  </span>
                </div>
                <span className="text-xs font-semibold text-[var(--text-muted)] block mt-0.5">
                  أهلاً بكم في عالم Morrow التفاعلي
                </span>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onComplete}
              data-testid="onboarding-skip-btn"
              whileHover={reducedMotion ? undefined : { y: -1, scale: 1.02 }}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-white/[0.04] hover:bg-[var(--bg-nav-active)] text-xs font-bold text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              دخول سريع
            </motion.button>
          </div>

          {/* Laser Progress Bar */}
          <div className="relative z-10 mb-6">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] mb-2">
              <span>{current.badge}</span>
              <span
                dir="ltr"
                className="font-mono-num tabular-nums"
                style={{ color: 'var(--accent-bright)' }}
              >
                0{stepIndex + 1} / 0{SLIDES.length}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--accent-deep) 0%, var(--accent) 55%, var(--accent-bright) 100%)',
                  boxShadow: '0 0 16px var(--spatial-glow)',
                }}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Split 3D Stage: Copy + Interactive 3D Smart Cat Companion */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.95fr] gap-6 items-center">
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
                  className="space-y-4"
                >
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-[var(--bg-nav-active)] text-[11px] font-bold"
                    style={{
                      borderColor: 'var(--border-color)',
                      color: 'var(--accent-bright)',
                    }}
                  >
                    <CurrentIcon size={14} style={{ color: 'var(--accent)' }} />
                    <span>{current.metric}</span>
                  </div>

                  <h1 className="font-display-ar text-2xl sm:text-3xl lg:text-[34px] font-black leading-snug text-[var(--text-primary)]">
                    {current.title}
                  </h1>

                  <p className="text-sm sm:text-[15px] leading-relaxed text-[var(--text-muted)]">
                    {current.subtitle}
                  </p>

                  {/* Slide-Synced 3D Geometric Highlight Tiles */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    {current.highlights.map((item, idx) => {
                      const ItemIcon = item.icon;
                      return (
                        <motion.div
                          key={item.label}
                          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: reducedMotion ? 0 : 0.06 * idx,
                            duration: 0.32,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          whileHover={reducedMotion ? undefined : { y: -3, scale: 1.02 }}
                        >
                          <RecessedChannelWell className="px-2 py-2.5 sm:p-3 text-center h-full relative overflow-hidden">
                            <div
                              aria-hidden="true"
                              className="absolute inset-x-3 top-0 h-[1.5px] opacity-75"
                              style={{
                                background:
                                  'linear-gradient(90deg, transparent, var(--accent-bright), transparent)',
                              }}
                            />
                            <div className="text-[10px] font-bold text-[var(--text-muted)] leading-tight">
                              {item.label}
                            </div>
                            <div
                              className="text-[11px] sm:text-xs font-black mt-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 leading-tight"
                              style={{ color: 'var(--accent-bright)' }}
                            >
                              <ItemIcon size={12} style={{ color: 'var(--accent)' }} className="shrink-0" />
                              <span>{item.value}</span>
                            </div>
                          </RecessedChannelWell>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Interactive Cyber-Geometric 3D Smart Cat Mascot */}
            <MorrowMascot3D
              themeId={themeId}
              spatialPrefs={spatialPrefs}
              activeSlideIndex={stepIndex}
              reduceMotion={reducedMotion}
            />
          </div>

          <div className="laser-divider my-6" />

          {/* Navigation Controls */}
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {SLIDES.map((s, idx) => {
                const active = idx === stepIndex;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    aria-label={`الانتقال إلى الشريحة ${idx + 1}`}
                    onClick={() => setStepIndex(idx)}
                    animate={{ width: active ? 34 : 10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="h-2.5 rounded-full cursor-pointer"
                    style={{
                      backgroundColor: active
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.22)',
                      boxShadow: active ? '0 0 12px var(--spatial-glow)' : 'none',
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2.5">
              {stepIndex > 0 && (
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -1.5 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRight size={14} />
                  <span>السابق</span>
                </motion.button>
              )}

              <motion.button
                type="button"
                data-testid="onboarding-next-btn"
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
        </GlassBentoCard>
      </motion.div>
    </div>
  );
};
