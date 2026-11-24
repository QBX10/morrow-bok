import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronDown, ChevronUp, GitMerge, ShieldCheck, Sparkles, SkipForward } from 'lucide-react';
import type { AssistantCollaborationStep } from '../../types/assistant';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface MorrowCollaborationTraceProps {
  trace: AssistantCollaborationStep[];
  compact?: boolean;
}

export const MorrowCollaborationTrace: React.FC<MorrowCollaborationTraceProps> = ({
  trace,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useTabrixReducedMotion();
  const traceVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;

  const summaryMeta = useMemo(() => {
    const activeSteps = trace.filter((s) => s.status !== 'skipped');
    const uniqueLabels: string[] = [];
    for (const step of activeSteps) {
      if (!uniqueLabels.includes(step.modelLabel)) {
        uniqueLabels.push(step.modelLabel);
      }
    }
    const totalLatency = activeSteps.reduce((sum, s) => sum + (s.latencyMs || 0), 0);
    return {
      stepCount: activeSteps.length || trace.length,
      modelsText: uniqueLabels.slice(0, 3).join(' ← '),
      totalLatency,
      hasVerifier: activeSteps.some((s) => s.role === 'verifier'),
    };
  }, [trace]);

  if (!trace || trace.length === 0) return null;

  return (
    <div
      className="mt-2.5 rounded-xl border text-[11px] transition-colors"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-2 text-right transition-opacity hover:opacity-90 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {summaryMeta.hasVerifier ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
          ) : (
            <GitMerge className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
          )}
          <span className="truncate font-bold" style={{ color: 'var(--text-primary)' }}>
            تعاون {summaryMeta.stepCount} مراحل
            {summaryMeta.modelsText ? (
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}· {summaryMeta.modelsText}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
          {summaryMeta.totalLatency > 0 && (
            <span dir="ltr" className="font-mono text-[10px] tabular-nums">
              {summaryMeta.totalLatency >= 1000
                ? `${(summaryMeta.totalLatency / 1000).toFixed(1)}s`
                : `${summaryMeta.totalLatency}ms`}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="collab-trace-steps"
            variants={traceVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="divide-y border-t overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {trace.map((step) => {
              const isVerifier = step.role === 'verifier';
              const isSkipped = step.status === 'skipped';
              return (
                <div
                  key={step.id}
                  className={`flex items-start justify-between gap-2.5 ${
                    compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {isSkipped ? (
                      <SkipForward
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    ) : isVerifier ? (
                      <Sparkles
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    ) : (
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--success)' }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 font-bold">
                        <span>{step.roleLabel}</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span
                          className="font-semibold"
                          style={{ color: isSkipped ? 'var(--text-muted)' : 'var(--accent)' }}
                        >
                          {step.modelLabel}
                        </span>
                      </div>
                      {step.summary && (
                        <div
                          className="mt-0.5 text-[11px] leading-relaxed"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {step.summary}
                        </div>
                      )}
                    </div>
                  </div>

                  {step.latencyMs > 0 && (
                    <span
                      dir="ltr"
                      className="shrink-0 font-mono text-[10px] tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {step.latencyMs}ms
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
