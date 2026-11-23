import React from 'react';
import { ArrowUpLeft } from 'lucide-react';

export interface ResultCardAction {
  id: string;
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface ResultCardMetricBar {
  label: string;
  value: number;
  max: number;
  displayValue: string;
  color?: string;
}

interface ResultCardProps {
  title: string;
  summary: string;
  details?: string[];
  scorePercent?: number;
  scoreLabel?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  bars?: ResultCardMetricBar[];
  actions?: ResultCardAction[];
  children?: React.ReactNode;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  title,
  summary,
  details,
  scorePercent,
  scoreLabel,
  tone = 'accent',
  bars,
  actions,
  children,
}) => {
  const toneColor =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'warning'
      ? 'var(--warning)'
      : tone === 'danger'
      ? 'var(--danger)'
      : 'var(--accent)';

  const clampedScore =
    typeof scorePercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(scorePercent)))
      : null;
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = clampedScore !== null ? c - (clampedScore / 100) * c : c;

  return (
    <div
      className="cosmos-glass-panel border p-4 sm:p-5 space-y-3"
      style={{
        borderColor: `color-mix(in srgb, ${toneColor} 36%, var(--border-color))`,
      }}
    >
      {/* Top: Summary + optional Health Ring */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-sm sm:text-base font-extrabold">{title}</h4>
          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {summary}
          </p>
        </div>

        {clampedScore !== null && (
          <div className="flex flex-col items-center shrink-0">
            <div className="relative h-12 w-12 flex items-center justify-center">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                <circle
                  cx="24"
                  cy="24"
                  r={r}
                  fill="none"
                  stroke="var(--border-color)"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={r}
                  fill="none"
                  stroke={toneColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                />
              </svg>
              <span className="absolute text-[11px] font-extrabold tabular-nums">
                {clampedScore}%
              </span>
            </div>
            {scoreLabel && (
              <span className="mt-0.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {scoreLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Optional Mini Bars */}
      {bars && bars.length > 0 && (
        <div className="space-y-2 pt-1">
          {bars.map((bar) => {
            const pct = bar.max > 0 ? Math.min(100, Math.round((bar.value / bar.max) * 100)) : 0;
            return (
              <div key={bar.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold truncate">{bar.label}</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {bar.displayValue}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-main)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: bar.color || toneColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Details */}
      {details && details.length > 0 && (
        <ul
          className="space-y-1 border-t pt-2.5 text-xs"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          {details.map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: toneColor }}>•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {children}

      {/* Direct Action Buttons */}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actions.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-opacity hover:opacity-90"
              style={
                act.primary
                  ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                  : {
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }
              }
            >
              <span>{act.label}</span>
              <ArrowUpLeft className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
