import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface MorrowSubPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

export const MorrowSubPageHeader: React.FC<MorrowSubPageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'العودة إلى المحادثة',
  rightSlot,
}) => {
  const reducedMotion = useTabrixReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
      initial="initial"
      animate="animate"
      className="mb-4 flex flex-nowrap items-center justify-between gap-2 border-b pb-3"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <motion.button
          type="button"
          data-testid="morrow-subpage-back-btn"
          onClick={onBack}
          whileHover={reducedMotion ? undefined : { x: 2, scale: 1.02 }}
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          transition={TABRIX_TACTILE_SPRING}
          className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 border px-3.5 text-xs font-extrabold whitespace-nowrap shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
          <span>{backLabel}</span>
        </motion.button>

        <div className="min-w-0">
          <h1 className="truncate text-sm sm:text-base font-extrabold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
    </motion.div>
  );
};
