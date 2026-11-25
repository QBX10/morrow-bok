import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { AppToastItem } from '../types/assistant';
import {
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TOAST_VARIANTS,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';

interface ToastHostProps {
  toasts: AppToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastHost: React.FC<ToastHostProps> = ({ toasts, onDismiss }) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-label="إشعارات العمليات"
      className="no-print pointer-events-none fixed bottom-16 left-1/2 z-[80] flex w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 sm:bottom-5"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => {
          const borderColor =
            t.tone === 'success'
              ? 'var(--success)'
              : t.tone === 'warning'
              ? 'var(--warning)'
              : t.tone === 'error'
              ? 'var(--danger)'
              : 'var(--accent)';

          const Icon =
            t.tone === 'success'
              ? CheckCircle2
              : t.tone === 'warning'
              ? AlertTriangle
              : t.tone === 'error'
              ? XCircle
              : Info;

          return (
            <motion.div
              key={t.id}
              layout={!reducedMotion}
              role="status"
              variants={
                reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_TOAST_VARIANTS
              }
              initial="initial"
              animate="animate"
              exit="exit"
              className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 shadow-xl backdrop-blur-xl"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
                borderColor,
                color: 'var(--text-primary)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 34px -14px rgba(2,10,22,0.85)',
              }}
            >
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: borderColor }}
              />
              <div className="min-w-0 flex-1 text-right">
                <div className="text-xs font-bold leading-snug">{t.title}</div>
                {t.description && (
                  <div
                    className="mt-0.5 text-[11px] leading-snug"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="إغلاق الإشعار"
                className="rounded p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
