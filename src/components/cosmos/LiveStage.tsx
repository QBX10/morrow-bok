import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface LiveStageProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  defaultCollapsed?: boolean;
  badgeText?: string;
  children: React.ReactNode;
}

export const LiveStage: React.FC<LiveStageProps> = ({
  title,
  subtitle,
  accentColor,
  defaultCollapsed = false,
  badgeText,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section
      aria-label={title}
      className="cosmos-glass-panel border overflow-hidden transition-all"
      style={{
        borderColor: accentColor
          ? `color-mix(in srgb, ${accentColor} 32%, var(--border-color))`
          : 'var(--border-color)',
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right sm:px-5"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: accentColor
                ? `color-mix(in srgb, ${accentColor} 16%, transparent)`
                : 'var(--bg-nav-active)',
              color: accentColor || 'var(--accent)',
            }}
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold">{title}</span>
              {badgeText && (
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: accentColor || 'var(--accent)' }}
                >
                  · {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1 text-xs font-bold shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>{collapsed ? 'إظهار المسرح' : 'طي المسرح'}</span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </span>
      </button>

      {!collapsed && (
        <div
          className="border-t px-4 py-4 sm:px-5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {children}
        </div>
      )}
    </section>
  );
};
