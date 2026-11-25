import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';
import { NexusDuotoneIcon } from './NexusDuotoneIcon';

export interface SmartDashboardSubIcon {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export interface SmartDashboardCardProps {
  title: string;
  subtitle: string;
  metaText?: string;
  icon: React.ReactNode;
  accentTone?: 'gold' | 'emerald' | 'crimson';
  subIcons: SmartDashboardSubIcon[];
  actionLabel?: string;
  active?: boolean;
  testId?: string;
  onOpen: () => void;
}

/**
 * SmartDashboardCard — Nexus Slate ("السبج والذهب") living portal card
 * with cursor-reactive golden sheen, staggered sub-icon micro-motion,
 * and dynamic hover states while keeping metadata clean (zero pill slop).
 */
export const SmartDashboardCard: React.FC<SmartDashboardCardProps> = ({
  title,
  subtitle,
  metaText,
  icon,
  accentTone = 'gold',
  subIcons,
  actionLabel = 'فتح القسم',
  active = false,
  testId,
  onOpen,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useTabrixReducedMotion();
  const displaySubIcons = subIcons.slice(0, 4);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    el.style.setProperty('--card-mx', `${(nx * 100).toFixed(1)}%`);
    el.style.setProperty('--card-my', `${(ny * 100).toFixed(1)}%`);
    if (document.documentElement.dataset.reduceMotion !== '1') {
      const rx = ((0.5 - ny) * 5.2).toFixed(2);
      const ry = ((nx - 0.5) * 6.4).toFixed(2);
      el.style.setProperty('--card-rx', `${rx}deg`);
      el.style.setProperty('--card-ry', `${ry}deg`);
    }
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--card-rx', '0deg');
    el.style.setProperty('--card-ry', '0deg');
  };

  return (
    <article
      ref={cardRef}
      data-testid={testId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="nexus-squircle smart-dashboard-card group relative flex flex-col justify-between gap-4 overflow-hidden p-5 text-right"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
      }}
    >
      {/* Dynamic Pointer-Reactive Marine Specular Sheen */}
      <div
        aria-hidden="true"
        className="smart-dashboard-card-sheen pointer-events-none absolute inset-0"
      />

      {/* Top Interactive Entry Header */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={actionLabel ? `${title} — ${actionLabel}` : title}
        className="relative z-[1] flex w-full items-start gap-3.5 text-right focus-visible:rounded-2xl"
      >
        <NexusDuotoneIcon
          tone={accentTone}
          sizeClass="h-11 w-11"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.07] group-hover:-rotate-2"
        >
          {icon}
        </NexusDuotoneIcon>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-black leading-snug transition-colors duration-200 group-hover:text-[var(--accent)]">
              {title}
            </h3>
            <ArrowLeft
              className="h-4 w-4 shrink-0 opacity-45 transition-all duration-200 group-hover:-translate-x-1.5 group-hover:opacity-100"
              style={{ color: 'var(--accent)' }}
              aria-hidden="true"
            />
          </div>

          <p
            className="mt-1 text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {subtitle}
          </p>

          {metaText && (
            <div
              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
                style={{
                  backgroundColor: 'var(--accent)',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 65%, transparent)',
                }}
              />
              <span className="truncate group-hover:text-[var(--text-primary)] transition-colors duration-200">
                {metaText}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Section-Specific Sub-Icons Grid with Living Staggered Micro-Motion */}
      {displaySubIcons.length > 0 && (
        <div
          className="relative z-[1] grid grid-cols-4 gap-2 border-t pt-3.5"
          style={{
            borderColor:
              'color-mix(in srgb, var(--border-color) 80%, transparent)',
          }}
          role="group"
          aria-label={`اختصارات ${title}`}
        >
          {displaySubIcons.map((sub, idx) => (
            <motion.button
              key={sub.id}
              type="button"
              title={sub.hint || sub.label}
              aria-label={sub.hint ? `${sub.label} — ${sub.hint}` : sub.label}
              whileHover={reducedMotion ? undefined : { y: -3, scale: 1.04 }}
              whileTap={reducedMotion ? undefined : { scale: 0.94 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={() => {
                if (sub.onClick) {
                  sub.onClick();
                } else {
                  onOpen();
                }
              }}
              style={{
                transitionDelay: `${idx * 24}ms`,
                backgroundColor: sub.active
                  ? 'var(--bg-nav-active)'
                  : 'color-mix(in srgb, var(--bg-main) 76%, transparent)',
                borderColor: sub.active
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--border-color) 85%, transparent)',
                color: sub.active ? 'var(--accent)' : 'var(--text-primary)',
              }}
              className="smart-dashboard-subicon flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center"
            >
              <span
                className="smart-dashboard-subicon-glyph flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: sub.active
                    ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
                    : 'color-mix(in srgb, var(--bg-surface) 75%, transparent)',
                  color: sub.active ? 'var(--accent)' : 'var(--text-muted)',
                }}
                aria-hidden="true"
              >
                {sub.icon}
              </span>
              <span className="line-clamp-1 w-full text-[11px] font-bold leading-tight">
                {sub.label}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Subtle Living Footer Trigger */}
      <div
        className="relative z-[1] flex items-center justify-between border-t pt-2.5 text-[11px] font-extrabold"
        style={{
          borderColor: 'color-mix(in srgb, var(--border-color) 65%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 transition-colors duration-200 group-hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>{actionLabel}</span>
        </button>
        <motion.button
          type="button"
          onClick={onOpen}
          aria-hidden="true"
          tabIndex={-1}
          whileHover={reducedMotion ? undefined : { scale: 1.05 }}
          whileTap={reducedMotion ? undefined : { scale: 0.94 }}
          transition={TABRIX_TACTILE_SPRING}
          className="nexus-pill-btn inline-flex items-center gap-1 border px-2.5 py-1 text-[10px] font-extrabold opacity-80 transition-all duration-200 group-hover:opacity-100 group-hover:border-[var(--accent)]"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
            color: 'var(--accent)',
          }}
        >
          <span>دخول</span>
          <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
        </motion.button>
      </div>
    </article>
  );
};
