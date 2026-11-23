import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { AppToastItem } from '../types/assistant';

interface ToastHostProps {
  toasts: AppToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastHost: React.FC<ToastHostProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="إشعارات العمليات"
      className="no-print pointer-events-none fixed bottom-16 left-1/2 z-[80] flex w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 sm:bottom-5"
    >
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
          <div
            key={t.id}
            role="status"
            className="tabrix-popover-enter pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor,
              color: 'var(--text-primary)',
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
              className="rounded p-0.5 opacity-70 hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
