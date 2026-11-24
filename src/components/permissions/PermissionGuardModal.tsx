import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, CheckCircle2, Mic, RefreshCw, ShieldAlert } from 'lucide-react';
import type { MediaPermissionGuide } from '../../utils/mediaPermissions.ts';
import {
  TABRIX_EASE,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
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
  const [cachedGuide, setCachedGuide] = useState<MediaPermissionGuide | null>(guide);
  const reducedMotion = useTabrixReducedMotion();

  useEffect(() => {
    if (guide) {
      setCachedGuide(guide);
    }
  }, [guide]);

  const displayGuide = guide ?? cachedGuide;
  const isOpen = open && Boolean(guide);
  const isCamera = displayGuide?.kind === 'camera';

  return (
    <FullScreenPushPage
      open={isOpen}
      onBack={onClose}
      title={displayGuide?.title || 'التحقق من الأذونات'}
      subtitle="حماية الأمان والأذونات في Morrow"
      icon={isCamera ? <Camera className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      maxWidthClass="max-w-lg"
      zIndexClass="z-[90]"
      footer={
        displayGuide ? (
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              onClick={onRetryPermission}
              disabled={checking}
              whileHover={reducedMotion || checking ? undefined : { y: -1.5, scale: 1.015 }}
              whileTap={reducedMotion || checking ? undefined : { scale: 0.96 }}
              transition={TABRIX_TACTILE_SPRING}
              className="nexus-pill-btn inline-flex flex-1 items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'جارٍ الفحص...' : 'إعادة فحص الإذن الآن'}</span>
            </motion.button>

            {onUseFallback && (
              <motion.button
                type="button"
                whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                transition={TABRIX_TACTILE_SPRING}
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
              </motion.button>
            )}
          </div>
        ) : undefined
      }
    >
      {displayGuide ? (
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
              <span>{displayGuide.reason}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold">خطوات التفعيل الآمن في المتصفح:</div>
            <ol className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {displayGuide.steps.map((step, idx) => (
                <motion.li
                  key={idx}
                  initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04, ease: TABRIX_EASE }}
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
                </motion.li>
              ))}
            </ol>
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {displayGuide.fallbackHint}
          </p>
        </div>
      ) : null}
    </FullScreenPushPage>
  );
};
