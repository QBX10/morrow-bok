import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { NexusDuotoneIcon } from './NexusDuotoneIcon';

export interface SmartSubIconItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface SmartLivingSectionCardProps {
  title: string;
  subtitle: string;
  metaText?: string;
  icon: React.ReactNode;
  subIcons: SmartSubIconItem[];
  actionLabel?: string;
  active?: boolean;
  testId?: string;
  onOpen: () => void;
}

export const SmartLivingSectionCard: React.FC<SmartLivingSectionCardProps> = ({
  title,
  subtitle,
  icon,
  subIcons,
  actionLabel = 'فتح القسم',
  active = false,
  testId,
  onOpen,
}) => {
  const displaySubIcons = subIcons.slice(0, 4);

  return (
    <article
      data-testid={testId}
      className="nexus-squircle nexus-squircle-interactive group flex flex-col justify-between gap-4 p-5 text-right"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
      }}
    >
      {/* Top Area: Clean Clickable Header + Concise Summary + Subtle Entry Arrow */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={actionLabel ? `${title} — ${actionLabel}` : title}
        className="flex w-full items-start gap-3.5 text-right focus-visible:rounded-2xl"
      >
        <NexusDuotoneIcon
          sizeClass="h-11 w-11"
          className="transition-transform duration-200 group-hover:scale-[1.05]"
        >
          {icon}
        </NexusDuotoneIcon>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-extrabold leading-snug transition-colors group-hover:text-[var(--accent)]">
              {title}
            </h2>
            <ArrowLeft
              className="h-4 w-4 shrink-0 opacity-55 transition-all duration-200 group-hover:-translate-x-1 group-hover:opacity-100"
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
        </div>
      </button>

      {/* Clean Row of 4 Distinct Visual Sub-Icons */}
      {displaySubIcons.length > 0 && (
        <div
          className="grid grid-cols-4 gap-2 border-t pt-3.5"
          style={{
            borderColor:
              'color-mix(in srgb, var(--border-color) 80%, transparent)',
          }}
          role="group"
          aria-label={`محتويات ${title}`}
        >
          {displaySubIcons.map((sub, idx) => (
            <button
              key={sub.id}
              type="button"
              title={sub.hint || sub.label}
              aria-label={sub.hint ? `${sub.label} — ${sub.hint}` : sub.label}
              onClick={() => {
                if (sub.onClick) {
                  sub.onClick();
                } else {
                  onOpen();
                }
              }}
              style={{
                transitionDelay: `${idx * 20}ms`,
                backgroundColor: sub.active
                  ? 'var(--bg-nav-active)'
                  : 'color-mix(in srgb, var(--bg-main) 72%, transparent)',
                borderColor: sub.active
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--border-color) 82%, transparent)',
                color: sub.active ? 'var(--accent)' : 'var(--text-primary)',
              }}
              className="smart-living-subicon flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center active:scale-[0.98]"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center"
                style={{ color: sub.active ? 'var(--accent)' : '#8A8A9E' }}
                aria-hidden="true"
              >
                {sub.icon}
              </span>
              <span className="line-clamp-1 w-full text-[11px] font-bold leading-tight">
                {sub.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
};
