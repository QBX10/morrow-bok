import React from 'react';
import { Camera, CheckCircle2, Mic, RefreshCw, ShieldAlert } from 'lucide-react';
import type { MediaPermissionGuide } from '../../utils/mediaPermissions.ts';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';

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
    <FullScreenPushPage
      open={open && Boolean(guide)}
      onBack={onClose}
      title={guide.title}
      subtitle="حماية الأمان والأذونات في Morrow"
      icon={isCamera ? <Camera className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      maxWidthClass="max-w-lg"
      zIndexClass="z-[90]"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRetryPermission}
            disabled={checking}
            className="nexus-pill-btn inline-flex flex-1 items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50"
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
              className="nexus-pill-btn inline-flex items-center justify-center gap-1.5 border px-4 py-2.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
              <span>{fallbackLabel || (isCamera ? 'رفع صورة من الجهاز' : 'الكتابة نصياً')}</span>
            </button>
          )}
        </div>
      }
    >
      <div className="nexus-squircle p-5 sm:p-6 space-y-4">
        <div
          className="rounded-2xl border p-3.5 text-xs leading-relaxed font-semibold"
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
          <ol className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {guide.steps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold tabular-nums"
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
      </div>
    </FullScreenPushPage>
  );
};
