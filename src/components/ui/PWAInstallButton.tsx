import React, { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../lib/pwaInstall';

interface PWAInstallButtonProps {
  variant?: 'menu' | 'card';
  onActionDone?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'menu',
  onActionDone,
}) => {
  const { canInstall, isInstalled, isIos, installing, promptInstall } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled) return null;

  if (!canInstall && !isIos) {
    if (variant === 'menu') return null;
    return (
      <div
        className="rounded-2xl border p-4 text-xs"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--text-primary)' }}>
          <Smartphone className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>العمل كتطبيق مستقل (PWA)</span>
        </div>
        <p className="mt-1 leading-relaxed">
          يدعم التطبيق العمل بدون إنترنت بالكامل والحفظ والمزامنة التلقائية. لتثبيته على جهازك، استخدم خيار «تثبيت التطبيق / Add to Home Screen» من قائمة المتصفح.
        </p>
      </div>
    );
  }

  if (variant === 'menu') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          disabled={installing}
          onClick={async () => {
            if (canInstall) {
              await promptInstall();
              onActionDone?.();
            } else if (isIos) {
              setShowIosGuide((v) => !v);
            }
          }}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right font-bold transition-colors hover:bg-[var(--bg-nav-active)] disabled:opacity-50"
        >
          <span>{installing ? 'جاري التثبيت...' : 'تثبيت التطبيق على الجهاز'}</span>
          {isIos && !canInstall ? (
            <Share className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          ) : (
            <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          )}
        </button>
        {showIosGuide && isIos && !canInstall && (
          <div
            className="rounded-xl border px-2.5 py-2 text-[11px] leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--accent)',
              color: 'var(--text-muted)',
            }}
          >
            اضغط زر المشاركة <Share className="inline h-3 w-3" /> في شريط Safari ثم اختر «إضافة إلى الشاشة الرئيسية».
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4 text-xs space-y-2.5"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--accent)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--text-primary)' }}>
            <Smartphone className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>تثبيت Morrow كتطبيق مستقل على جهازك</span>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            فتح سريع بدون متصفح + عمل كامل أوفلاين + مزامنة تلقائية فور عودة الإنترنت.
          </p>
        </div>

        <button
          type="button"
          disabled={installing}
          onClick={async () => {
            if (canInstall) {
              await promptInstall();
            } else if (isIos) {
              setShowIosGuide((v) => !v);
            }
          }}
          className="nexus-pill-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          {isIos && !canInstall ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          <span>{installing ? 'جاري التثبيت...' : 'تثبيت الآن'}</span>
        </button>
      </div>

      {showIosGuide && isIos && !canInstall && (
        <div className="rounded-xl border p-2.5 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          على آيفون/آيباد: اضغط على أيقونة المشاركة <Share className="inline h-3 w-3" /> في أسفل Safari ثم اختر «إضافة إلى الشاشة الرئيسية».
        </div>
      )}
    </div>
  );
};
