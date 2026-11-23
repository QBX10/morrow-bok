import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, X } from 'lucide-react';
import {
  buildPermissionRecoveryGuide,
  requestCameraStreamSafe,
  type MediaPermissionGuide,
} from '../../utils/mediaPermissions';
import { PermissionGuardModal } from '../permissions/PermissionGuardModal';

interface MorrowCameraSnapModalProps {
  open: boolean;
  onClose: () => void;
  onCaptureFile: (file: File) => void;
}

export const MorrowCameraSnapModal: React.FC<MorrowCameraSnapModalProps> = ({
  open,
  onClose,
  onCaptureFile,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionGuide, setPermissionGuide] = useState<MediaPermissionGuide | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setReady(false);
  };

  const startCamera = async () => {
    setErrorMsg(null);
    stopStream();
    const res = await requestCameraStreamSafe();
    if (!res.ok || !res.stream) {
      const guide =
        res.guide ||
        buildPermissionRecoveryGuide(
          'camera',
          'تعذر تشغيل الكاميرا مباشرة. يمكنك التقاط صورة من ملف أو منح إذن الكاميرا.'
        );
      setErrorMsg(guide.reason);
      setPermissionGuide(guide);
      return;
    }
    streamRef.current = res.stream;
    setReady(true);
    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = res.stream!;
        void videoRef.current.play().catch(() => {});
      }
    });
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    void startCamera();
    return () => stopStream();
  }, [open]);

  const handleSnap = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `morrow-camera-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        stopStream();
        onCaptureFile(file);
        onClose();
      },
      'image/jpeg',
      0.92
    );
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تصوير ملف أو دفتر بالكاميرا"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: 'rgba(6, 10, 20, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[26px] border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Camera className="h-4.5 w-4.5" style={{ color: 'var(--accent)' }} />
            <span>تصوير مستند أو دفتر بالكاميرا</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="إغلاق الكاميرا"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black flex items-center justify-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            {!ready && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs"
                style={{ color: '#e2e8f0' }}
              >
                <Camera className="h-8 w-8 opacity-75" />
                <span>{errorMsg || 'جاري تشغيل الكاميرا...'}</span>
              </div>
            )}
          </div>

          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) {
                stopStream();
                onCaptureFile(f);
                onClose();
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void startCamera()}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>إعادة تشغيل</span>
              </button>

              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>اختيار صورة من الجهاز</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!ready}
              onClick={() => void handleSnap()}
              className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-extrabold disabled:opacity-45"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Camera className="h-4 w-4" />
              <span>التقاط الصورة الآن</span>
            </button>
          </div>
        </div>
      </div>

      <PermissionGuardModal
        open={Boolean(permissionGuide)}
        guide={permissionGuide}
        onClose={() => setPermissionGuide(null)}
        onRetryPermission={() => {
          setPermissionGuide(null);
          void startCamera();
        }}
      />
    </div>
  );
};
