import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  allowFullscreen?: boolean;
  initialFullscreen?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  allowFullscreen = true,
  initialFullscreen = false,
  maxWidthClass = 'max-w-2xl',
  children,
  footer,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDragOffsetY(0);
      setIsFullscreen(initialFullscreen);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, initialFullscreen]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFullscreen) return;
    dragStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null || isFullscreen) return;
    const dy = (e.touches[0]?.clientY ?? 0) - dragStartYRef.current;
    if (dy > 0) setDragOffsetY(Math.min(dy, 220));
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 90) {
      onClose();
    } else {
      setDragOffsetY(0);
    }
    dragStartYRef.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[var(--z-sheet)] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          paddingTop: isFullscreen ? 'env(safe-area-inset-top, 0px)' : undefined,
        }}
        className={`cosmos-sheet-enter flex w-full flex-col border shadow-2xl overflow-hidden ${
          isFullscreen
            ? 'h-[100dvh] max-w-none rounded-none sm:rounded-2xl'
            : `${maxWidthClass} max-h-[88dvh] rounded-t-[26px] sm:rounded-[24px]`
        }`}
      >
        {/* Drag handle (touch dismiss) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
        >
          <span
            className="h-1.5 w-11 rounded-full opacity-35"
            style={{ backgroundColor: 'var(--text-muted)' }}
          />
        </div>

        {/* Sheet Header (also supports swipe-down dismiss) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
                  color: 'var(--accent)',
                }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate">{title}</h3>
              {subtitle && (
                <p
                  className="text-[11px] sm:text-xs truncate mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {allowFullscreen && (
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label={isFullscreen ? 'تصغير الورقة' : 'توسيع ملء الشاشة'}
                className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 text-xs font-bold hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 text-xs font-bold hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div
            className="border-t px-4 py-3 sm:px-6"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
