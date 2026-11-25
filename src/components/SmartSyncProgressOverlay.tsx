import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Lock, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
import {
  TABRIX_MODAL_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';

export type SyncStageIndex = 0 | 1 | 2 | 3;

interface SmartSyncProgressOverlayProps {
  open: boolean;
  stage: SyncStageIndex;
  title?: string;
  subtitle?: string;
}

const STAGES = [
  {
    label: 'تجهيز البيانات',
    hint: 'تجميع السجلات والجداول والملاحظات والمرفقات بدقة',
    icon: Sparkles,
  },
  {
    label: 'ضغط آمن',
    hint: 'تمرير البيانات عبر الضغط الآمن والتحقق المزدوج من السلامة',
    icon: Lock,
  },
  {
    label: 'حفظ ومزامنة بأمان',
    hint: 'اعتماد نقطة الحفظ والتحقق النهائي من اكتمال العملية',
    icon: ShieldCheck,
  },
] as const;

export const SmartSyncProgressOverlay: React.FC<SmartSyncProgressOverlayProps> = ({
  open,
  stage,
  title = 'الحفظ والمزامنة الذكية',
  subtitle = 'تُنفَّذ العملية بهدوء في الخلفية مع فحص سلامة البيانات',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const isDone = stage >= 3;
  const pct = stage === 0 ? 30 : stage === 1 ? 66 : stage === 2 ? 92 : 100;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="smart-sync-overlay"
          role="status"
          aria-live="polite"
          aria-label={title}
          dir="rtl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <motion.div
            variants={
              reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_MODAL_VARIANTS
            }
            initial="initial"
            animate="animate"
            exit="exit"
            className="nexus-squircle w-full max-w-md p-6 sm:p-7 space-y-5 text-center"
            style={{
              borderColor:
                'color-mix(in srgb, var(--accent) 40%, var(--border-color))',
            }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor:
                  'color-mix(in srgb, var(--accent) 45%, var(--border-color))',
                color: isDone ? 'var(--success)' : 'var(--accent)',
              }}
            >
              {isDone ? (
                <PackageCheck className="h-7 w-7" />
              ) : (
                <ShieldCheck className="h-7 w-7 animate-pulse" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black">{title}</h3>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {subtitle}
              </p>
            </div>

            {/* Serene Progress Bar */}
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-main)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isDone ? 'var(--success)' : 'var(--accent)',
                }}
              />
            </div>

            {/* Human-Friendly 3-Stage Progression */}
            <div className="space-y-2 text-right">
              {STAGES.map((st, idx) => {
                const Icon = st.icon;
                const completed = stage > idx;
                const active = stage === idx;
                return (
                  <div
                    key={st.label}
                    className="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-all"
                    style={{
                      backgroundColor: active
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: active
                        ? 'var(--accent)'
                        : completed
                        ? 'color-mix(in srgb, var(--success) 45%, var(--border-color))'
                        : 'var(--border-color)',
                      opacity: stage < idx ? 0.55 : 1,
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        color: completed
                          ? 'var(--success)'
                          : active
                          ? 'var(--accent)'
                          : 'var(--text-muted)',
                      }}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon
                          className={`h-4 w-4 ${active ? 'animate-pulse' : ''}`}
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold">{st.label}</div>
                      <div
                        className="truncate text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {st.hint}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
