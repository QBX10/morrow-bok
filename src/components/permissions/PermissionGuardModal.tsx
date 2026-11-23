import React from 'react';
import { Camera, CheckCircle2, Mic, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type { MediaPermissionGuide } from '../../utils/mediaPermissions.ts';

interface PermissionGuardModalProps {
  open: boolean;
  guide: MediaPermissionGuide | null;
  checking?: boolean;
  onClose: () => void;
  onRetryPermission: () => void;
  onUseFallback?: () => void;
  fallbackLabel?: string;
}

export const PermissionGuardModal: React.FC<PermissionGuardModalProps> = ({
  open,
  guide,
  checking = false,
  onClose,
  onRetryPermission,
  onUseFallback,
  fallbackLabel,
}) => {
  if (!open || !guide) return null;

  const isCamera = guide.kind === 'camera';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={guide.title}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-xl space-y-4 tabrix-popover-enter"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              {isCamera ? <Camera className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold">{guide.title}</h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                حماية الأمان والأذونات في Morrow
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl border p-1.5 transition-opacity hover:opacity-75"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="rounded-xl border p-3 text-xs leading-relaxed font-semibold"
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'color-mix(in srgb, var(--danger) 40%, var(--border-color))',
            color: 'var(--danger)',
          }}
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{guide.reason}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-extrabold">خطوات التفعيل الآمن في المتصفح:</div>
          <ol className="space-y-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {guide.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    color: 'var(--accent)',
                  }}
                >
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {guide.fallbackHint}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onRetryPermission}
            disabled={checking}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'جارٍ الفحص...' : 'إعادة فحص الإذن الآن'}</span>
          </button>

          {onUseFallback && (
            <button
              type="button"
              onClick={() => {
                onUseFallback();
                onClose();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
              <span>{fallbackLabel || (isCamera ? 'رفع صورة من الجهاز' : 'الكتابة نصياً')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
