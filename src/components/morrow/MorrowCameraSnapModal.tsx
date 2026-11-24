import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload } from 'lucide-react';
import {
  buildPermissionRecoveryGuide,
  requestCameraStreamSafe,
  type MediaPermissionGuide,
} from '../../utils/mediaPermissions';
import { PermissionGuardModal } from '../permissions/PermissionGuardModal';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { NexusDuotoneIcon } from '../ui/NexusDuotoneIcon';
import { MorrowSubPageHeader } from './MorrowSubPageHeader';

interface MorrowCameraSnapModalProps {
  open: boolean;
  onClose: () => void;
  onCaptureFile: (file: File) => void;
  layout?: 'modal' | 'page';
}

export const MorrowCameraSnapModal: React.FC<MorrowCameraSnapModalProps> = ({
  open,
  onClose,
  onCaptureFile,
  layout = 'modal',
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

  const cameraCard = (
    <div className="nexus-squircle w-full overflow-hidden p-4 sm:p-5 space-y-4">
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startCamera()}
            className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 border px-4 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>إعادة تشغيل</span>
          </button>

          <button
            type="button"
            onClick={() => fallbackInputRef.current?.click()}
            className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 border px-4 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
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
          className="nexus-pill-btn inline-flex h-10 items-center gap-2 px-5 text-xs font-extrabold disabled:opacity-45"
          style={{
            backgroundColor: 'var(--accent-ai, #5B4FE9)',
            color: '#FFFFFF',
          }}
        >
          <Camera className="h-4 w-4" />
          <span>التقاط الصورة الآن</span>
        </button>
      </div>
    </div>
  );

  if (layout === 'page') {
    return (
      <main
        aria-label="تصوير ملف أو دفتر بالكاميرا"
        data-testid="morrow-camera-page"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        <MorrowSubPageHeader
          title="التقاط مستند أو دفتر بالكاميرا"
          subtitle="صوّر الكشف أو الوصل لتحليله مباشرة وإدراجه في المحادثة"
          onBack={() => {
            stopStream();
            onClose();
          }}
        />

        {cameraCard}

        {permissionGuide && (
          <div
            className="mt-4 nexus-squircle p-4 text-xs space-y-2"
            style={{
              backgroundColor: 'var(--warning-bg)',
              borderColor: 'var(--warning)',
            }}
          >
            <div className="font-extrabold" style={{ color: 'var(--warning)' }}>
              {permissionGuide.title}
            </div>
            <p>{permissionGuide.reason}</p>
            <ul
              className="list-disc pr-5 space-y-1 text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {permissionGuide.steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    );
  }

  return (
    <>
      <FullScreenPushPage
        open={open}
        onBack={() => {
          stopStream();
          onClose();
        }}
        title="تصوير مستند أو دفتر بالكاميرا"
        subtitle="صوّر الكشف أو الوصل لتحليله مباشرة وإدراجه في المحادثة"
        icon={
          <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
            <Camera className="h-4 w-4" />
          </NexusDuotoneIcon>
        }
        maxWidthClass="max-w-2xl"
        ariaLabel="تصوير ملف أو دفتر بالكاميرا"
      >
        {cameraCard}
      </FullScreenPushPage>

      <PermissionGuardModal
        open={Boolean(permissionGuide)}
        guide={permissionGuide}
        onClose={() => setPermissionGuide(null)}
        onRetryPermission={() => {
          setPermissionGuide(null);
          void startCamera();
        }}
      />
    </>
  );
};
