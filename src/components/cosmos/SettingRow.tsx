import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Info,
  RotateCcw,
  ShieldCheck,
  Star,
  Timer,
} from 'lucide-react';
import { SectionLogo } from '../settings/sectionLogos';
import type { HierarchyIconKey } from '../../utils/hierarchyRegistry';
import type { CosmosRiskLevel } from '../../utils/cosmosRegistry';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface SettingRowProps {
  id: string;
  title: string;
  description: string;
  icon: HierarchyIconKey;
  currentValueLabel?: string;
  isModified?: boolean;
  onResetSingle?: () => void;
  why?: string;
  affects?: string[];
  conflictHint?: string;
  riskLevel?: CosmosRiskLevel;
  safeTrialEnabled?: boolean;
  trialComparisonText?: string;
  trialTriggerSignal?: number;
  onConfirmSafeTrial?: () => void;
  onRevertSafeTrial?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  longPressPeekEnabled?: boolean;
  children: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  id,
  title,
  description,
  icon,
  currentValueLabel,
  isModified = false,
  onResetSingle,
  why,
  affects,
  conflictHint,
  riskLevel = 'safe',
  safeTrialEnabled = false,
  trialComparisonText,
  trialTriggerSignal,
  onConfirmSafeTrial,
  onRevertSafeTrial,
  isPinned = false,
  onTogglePin,
  longPressPeekEnabled = true,
  children,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [trialRemainingSec, setTrialRemainingSec] = useState<number | null>(null);
  const reducedMotion = useTabrixReducedMotion();
  const pressTimerRef = useRef<number | null>(null);
  const lastTrialSignalRef = useRef<number | undefined>(trialTriggerSignal);

  useEffect(() => {
    if (
      safeTrialEnabled &&
      trialTriggerSignal !== undefined &&
      trialTriggerSignal > 0 &&
      trialTriggerSignal !== lastTrialSignalRef.current
    ) {
      lastTrialSignalRef.current = trialTriggerSignal;
      setTrialRemainingSec(10);
    }
  }, [safeTrialEnabled, trialTriggerSignal]);

  useEffect(() => {
    if (trialRemainingSec === null) return;
    if (trialRemainingSec <= 0) {
      setTrialRemainingSec(null);
      onRevertSafeTrial?.();
      return;
    }
    const timer = window.setTimeout(() => {
      setTrialRemainingSec((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [trialRemainingSec, onRevertSafeTrial]);

  const startPressPeek = () => {
    if (!longPressPeekEnabled) return;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      setPeekOpen(true);
    }, 450);
  };

  const cancelPressPeek = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const triggerSafeTrial = () => {
    if (!safeTrialEnabled) return;
    setTrialRemainingSec(10);
  };

  return (
    <div
      id={`setting-row-${id}`}
      onPointerDown={startPressPeek}
      onPointerUp={cancelPressPeek}
      onPointerLeave={cancelPressPeek}
      className="relative rounded-[20px] border p-4 transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isModified
          ? 'color-mix(in srgb, #eab308 55%, var(--border-color))'
          : 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Right side (RTL): Icon + Name + 1-line description */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SectionLogo icon={icon} tone={riskLevel === 'protected' ? 'amber' : 'indigo'} size="sm" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {isModified && (
                <button
                  type="button"
                  onClick={onResetSingle}
                  title="معدَّل عن الافتراضي — انقر لإعادة ضبط هذا الإعداد وحده"
                  aria-label="إعادة ضبط هذا الإعداد للافتراضي"
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-400 ring-2 ring-amber-400/25 hover:scale-125 transition-transform"
                />
              )}
              <h4 className="text-sm font-extrabold">{title}</h4>
              {riskLevel !== 'safe' && (
                <span
                  title={
                    riskLevel === 'protected'
                      ? 'إعداد حساس محمي — يدعم التجربة الآمنة والاستعادة'
                      : 'إعداد متوسط التأثير'
                  }
                  className="inline-flex items-center gap-1 text-[10px] font-bold"
                  style={{ color: riskLevel === 'protected' ? 'var(--warning)' : 'var(--accent)' }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{riskLevel === 'protected' ? 'محمي' : 'مؤثر'}</span>
                </span>
              )}
              {currentValueLabel && (
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  · {currentValueLabel}
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
          </div>
        </div>

        {/* Left side (RTL): Utility actions (ⓘ, Pin, Reset) + Control */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(why || (affects && affects.length > 0) || conflictHint) && (
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              aria-label="توضيح الإعداد وتأثيراته"
              className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2 text-xs hover:border-[var(--accent)]"
              style={{
                backgroundColor: infoOpen ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              <Info className="h-4 w-4" />
            </button>
          )}

          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={isPinned ? 'إزالة من المفضلة' : 'تثبيت في المفضلة'}
              className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2 hover:border-[var(--accent)]"
              style={{
                backgroundColor: isPinned ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: isPinned ? '#eab308' : 'var(--text-muted)',
              }}
            >
              <Star className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>
          )}

          {isModified && onResetSingle && (
            <button
              type="button"
              onClick={onResetSingle}
              aria-label="إرجاع الافتراضي لهذا الخيار"
              className="cosmos-touch-target inline-flex items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>افتراضي</span>
            </button>
          )}

          {safeTrialEnabled && trialRemainingSec === null && (
            <button
              type="button"
              onClick={triggerSafeTrial}
              className="cosmos-touch-target inline-flex items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--accent)',
              }}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>جرّب 10ث</span>
            </button>
          )}

          <div className="min-w-[120px]">{children}</div>
        </div>
      </div>

      {/* 10-second Safe Trial Bar */}
      <AnimatePresence initial={false}>
        {trialRemainingSec !== null && (
          <motion.div
            key="safe-trial-bar"
            variants={
              reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
            }
            initial="initial"
            animate="animate"
            exit="exit"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--warning-bg)',
              borderColor: 'var(--warning)',
            }}
          >
            <div className="space-y-0.5">
              <span className="font-bold tabular-nums block">
                تجربة آمنة: سيعود الإعداد السابق تلقائياً خلال {trialRemainingSec} ثانية
              </span>
              {trialComparisonText && (
                <span className="text-[11px] font-semibold opacity-90 block">
                  {trialComparisonText}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrialRemainingSec(null);
                  onConfirmSafeTrial?.();
                }}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                تثبيت الآن
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrialRemainingSec(null);
                  onRevertSafeTrial?.();
                }}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                تراجع فوري
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⓘ Why / Impact / Conflict Popover */}
      <AnimatePresence initial={false}>
        {infoOpen && (
          <motion.div
            key="setting-info-popover"
            variants={
              reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
            }
            initial="initial"
            animate="animate"
            exit="exit"
            className="capsule-glass-card mt-3 rounded-xl border p-3 text-xs space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {why && (
              <p className="leading-relaxed">
                <strong style={{ color: 'var(--accent)' }}>لماذا يوجد هذا الخيار؟ </strong>
                {why}
              </p>
            )}
            {affects && affects.length > 0 && (
              <p style={{ color: 'var(--text-muted)' }}>
                <strong>يؤثر على: </strong>
                {affects.join(' · ')}
              </p>
            )}
            {conflictHint && (
              <p className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--warning)' }}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{conflictHint}</span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Long-Press Peek Micro Menu */}
      <AnimatePresence initial={false}>
        {peekOpen && (
          <motion.div
            key="setting-peek-popover"
            variants={
              reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
            }
            initial="initial"
            animate="animate"
            exit="exit"
            className="capsule-glass-card mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'var(--accent)',
            }}
          >
            <span className="font-bold">معاينة سريعة ({title})</span>
            <div className="flex items-center gap-2">
              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePin();
                    setPeekOpen(false);
                  }}
                  className="rounded-lg border px-2.5 py-1 font-bold"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                  {isPinned ? 'إلغاء التثبيت' : 'تثبيت في المفضلة'}
                </button>
              )}
              {onResetSingle && (
                <button
                  type="button"
                  onClick={() => {
                    onResetSingle();
                    setPeekOpen(false);
                  }}
                  className="rounded-lg border px-2.5 py-1 font-bold"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                  استرجاع الافتراضي
                </button>
              )}
              <button
                type="button"
                onClick={() => setPeekOpen(false)}
                className="rounded-lg px-2 py-1 font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
