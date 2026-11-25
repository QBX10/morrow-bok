import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import {
  TABRIX_PUSH_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import { playTactileFeedback } from '../../utils/tactileFeedback';

interface FullScreenPushPageProps {
  open: boolean;
  onBack?: () => void;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backLabel?: string;
  headerActions?: React.ReactNode;
  maxWidthClass?: string;
  footer?: React.ReactNode;
  ariaLabel?: string;
  hideBack?: boolean;
  zIndexClass?: string;
  children: React.ReactNode;
}

/**
 * Full-Screen Push Navigation Container ("Tabrix 2D Push").
 * Replaces popups, modals, and bottom sheets with a calm, focused full-screen page
 * featuring smooth Framer Motion 2D Enter/Exit transitions and a slim frosted header.
 */
export const FullScreenPushPage: React.FC<FullScreenPushPageProps> = ({
  open,
  onBack,
  onClose,
  title,
  subtitle,
  icon,
  backLabel = 'رجوع',
  headerActions,
  maxWidthClass = 'max-w-4xl',
  footer,
  ariaLabel,
  hideBack = false,
  zIndexClass = 'z-[var(--z-modal)]',
  children,
}) => {
  const handleBack = onBack ?? onClose ?? (() => {});
  const reducedMotion = useTabrixReducedMotion();
  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (prevOpenRef.current !== open) {
      prevOpenRef.current = open;
      playTactileFeedback(open ? 'sheet_open' : 'sheet_close', {
        haptic: open,
        reduceMotion: reducedMotion,
      });
    }
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!open || hideBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hideBack, handleBack]);

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tabrix-push-page"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
          dir="rtl"
          variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_PUSH_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`fixed inset-0 ${zIndexClass} flex flex-col overflow-hidden`}
          style={{
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {/* Slim Frosted Glassmorphism Lite Header */}
          <header
            className="nexus-glass-lite sticky top-0 z-10 border-b px-3 py-2.5 sm:px-6"
            style={{
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {!hideBack && (
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label={backLabel}
                    className="nexus-pill-btn inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-extrabold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>{backLabel}</span>
                  </button>
                )}

                {icon && (
                  <span
                    className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      borderColor:
                        'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                      color: 'var(--accent)',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 14px -8px color-mix(in srgb, var(--accent) 40%, transparent)',
                    }}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                )}

                <div className="min-w-0">
                  <h2 className="truncate text-sm sm:text-base font-black leading-tight">
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      className="mt-0.5 truncate text-[11px] sm:text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {headerActions && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {headerActions}
                </div>
              )}
            </div>
          </header>

          {/* Main Scrollable Content Canvas */}
          <div className="tabrix-2d-stage flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-6">
            <div className={`mx-auto w-full ${maxWidthClass}`}>{children}</div>
          </div>

          {/* Optional Sticky Frosted Footer */}
          {footer && (
            <footer
              className="nexus-glass-lite border-t px-3 py-3 sm:px-6"
              style={{
                borderColor: 'var(--border-color)',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className={`mx-auto w-full ${maxWidthClass}`}>{footer}</div>
            </footer>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};
