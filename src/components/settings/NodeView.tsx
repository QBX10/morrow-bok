import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { HierarchyNode } from '../../utils/hierarchyRegistry';
import { SectionLogo } from './sectionLogos';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface NodeViewProps {
  node: HierarchyNode;
  displayMode: 'fullscreen' | 'contained';
  liveStatusText?: string;
  hasUnsavedDraft?: boolean;
  onResetBranch?: () => void;
  resetBranchLabel?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const NodeView: React.FC<NodeViewProps> = ({
  node,
  displayMode,
  liveStatusText,
  hasUnsavedDraft = false,
  onResetBranch,
  resetBranchLabel = 'استعادة افتراضيات هذا الفرع',
  headerActions,
  children,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <section
      key={node.id}
      data-capsule-node-id={node.id}
      aria-label={node.title}
      className={`space-y-5 ${
        displayMode === 'contained' ? 'mx-auto w-full max-w-6xl' : 'w-full'
      }`}
    >
      {/* Capsule Workspace Hero Strip */}
      <div
        className="capsule-glass-card flex flex-wrap items-center justify-between gap-4 border p-5 sm:p-6"
        style={{
          borderColor: node.protected
            ? 'color-mix(in srgb, var(--accent) 32%, var(--border-color))'
            : 'var(--border-color)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <SectionLogo
            icon={node.logo || node.icon}
            tone={node.accentTone}
            size="lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold sm:text-xl">{node.title}</h1>
              {liveStatusText && (
                <span
                  className="inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-bold tabular-nums whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    borderColor:
                      'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                    color: 'var(--accent)',
                  }}
                >
                  {liveStatusText}
                </span>
              )}
              {node.protected && (
                <span
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>فرع محمي · معاينة قبل الحفظ</span>
                </span>
              )}
              {hasUnsavedDraft && (
                <span
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--warning-bg)',
                    borderColor: 'var(--warning)',
                    color: 'var(--warning)',
                  }}
                >
                  تعديلات قيد المعاينة
                </span>
              )}
            </div>
            <p
              className="mt-1 text-xs sm:text-sm leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              {node.description || node.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {onResetBranch && !confirmingReset && (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>{resetBranchLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Safe Confirmation for Branch-Only Reset (Rule 1 & Rule 5) */}
      <AnimatePresence>
        {onResetBranch && confirmingReset && (
          <motion.div
            key="node-reset-confirm"
            role="alertdialog"
            aria-label="تأكيد استعادة افتراضيات هذا الفرع فقط"
            variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="capsule-glass-card flex flex-wrap items-center justify-between gap-3 border p-4 text-xs"
            style={{
              backgroundColor: 'var(--warning-bg)',
              borderColor: 'var(--warning)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="font-bold">
              سيتم استعادة الإعدادات الافتراضية لفرع «{node.title}» فقط دون مساس بالثيمات المخصصة أو بقية الفروع. هل تريد المتابعة؟
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetBranch();
                  setConfirmingReset(false);
                }}
                className="nexus-pill-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>نعم، استعادة هذا الفرع</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="nexus-pill-btn inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <X className="h-3.5 w-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focused Capsule Content */}
      <div className="space-y-5">{children}</div>
    </section>
  );
};
