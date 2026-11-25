import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  CheckCircle2,
  Eye,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  VideoOff,
} from 'lucide-react';
import {
  preprocessLedgerBurstFrames,
  type BurstFusionSummary,
} from '../../utils/ledgerImageProcessor';
import {
  acquireMusicPauseLock,
  releaseMusicPauseLock,
} from '../../utils/backgroundMusicEngine';
import { playTactileFeedback } from '../../utils/tactileFeedback';
import {
  buildPermissionRecoveryGuide,
  requestCameraStreamSafe,
  type MediaPermissionGuide,
} from '../../utils/mediaPermissions';
import { PermissionGuardModal } from '../permissions/PermissionGuardModal';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface BurstCameraCaptureProps {
  analyzing: boolean;
  scanMode?: 'fast' | 'audit';
  onBurstReadyAndAnalyze: (summary: BurstFusionSummary) => Promise<void>;
}

export const BurstCameraCapture: React.FC<BurstCameraCaptureProps> = ({
  analyzing,
  scanMode = 'audit',
  onBurstReadyAndAnalyze,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturingBurst, setCapturingBurst] = useState(false);
  const [processingFrames, setProcessingFrames] = useState(false);
  const [burstProgress, setBurstProgress] = useState(0);
  const [burstSummary, setBurstSummary] = useState<BurstFusionSummary | null>(
    null
  );
  const [showEnhancedPreview, setShowEnhancedPreview] = useState(true);
  const [permissionGuide, setPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const reducedMotion = useTabrixReducedMotion();
  const popoverVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive) {
      acquireMusicPauseLock('quick-extract:burst-camera', 'camera', 90);
    } else {
      releaseMusicPauseLock('quick-extract:burst-camera');
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => {
      releaseMusicPauseLock('quick-extract:burst-camera');
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError('');
    setCheckingPermission(true);
    acquireMusicPauseLock('quick-extract:burst-camera-request', 'camera', 70);
    try {
      stopCamera();
      const res = await requestCameraStreamSafe();
      if (!res.ok || !res.stream) {
        const fallbackGuide =
          res.guide ||
          buildPermissionRecoveryGuide(
            'camera',
            'تعذر تشغيل الكاميرا (تحقق من صلاحيات الكاميرا أو استخدم خيار رفع صور الدفتر مباشرة).'
          );
        setCameraError(fallbackGuide.reason);
        setPermissionGuide(fallbackGuide);
        setCameraActive(false);
        return;
      }

      setPermissionGuide(null);
      streamRef.current = res.stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = res.stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } finally {
      setCheckingPermission(false);
      releaseMusicPauseLock('quick-extract:burst-camera-request');
    }
  };

  const captureBurstFromVideo = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError('الكاميرا لا تزال قيد التهيئة، انتظر لحظة وحاول مجددًا.');
      return;
    }

    setCapturingBurst(true);
    setBurstProgress(0);
    setCameraError('');

    try {
      const capturedUrls: string[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر إنشاء لوحة الالتقاط.');

      const totalShots = scanMode === 'fast' ? 1 : 4;
      for (let i = 0; i < totalShots; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedUrls.push(canvas.toDataURL('image/jpeg', 0.94));
        playTactileFeedback('camera_shutter', { haptic: true });
        setBurstProgress(i + 1);
        if (i < totalShots - 1) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      setProcessingFrames(true);
      const summary = await preprocessLedgerBurstFrames(capturedUrls);
      setBurstSummary(summary);
      if (!summary.rejected && summary.acceptedFrames.length > 0) {
        stopCamera();
        if (scanMode === 'fast') {
          void onBurstReadyAndAnalyze(summary);
        }
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'فشل التقاط السلسلة المتتالية.'
      );
    } finally {
      setCapturingBurst(false);
      setProcessingFrames(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    e.target.value = '';
    if (files.length === 0) return;

    setCameraError('');
    setProcessingFrames(true);
    try {
      const summary = await preprocessLedgerBurstFrames(files);
      setBurstSummary(summary);
      if (
        scanMode === 'fast' &&
        !summary.rejected &&
        summary.acceptedFrames.length > 0
      ) {
        void onBurstReadyAndAnalyze(summary);
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'تعذر معالجة صور الدفتر المرفوعة.'
      );
    } finally {
      setProcessingFrames(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Controls & Live Viewfinder */}
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold">
            {scanMode === 'fast'
              ? 'الوضع السريع: التقاط فوري لقطة واحدة وسحب مباشر'
              : 'الوضع المدقق: التقاط سلسلة Burst (4 إطارات) وفحص الحروف المقتطفة'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={analyzing || processingFrames}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Camera className="h-4 w-4" />
                <span>تشغيل الكاميرا المباشرة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <VideoOff className="h-3.5 w-3.5" />
                <span>إغلاق الكاميرا</span>
              </button>
            )}

            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <ImagePlus className="h-4 w-4" />
              <span>رفع صورة أو عدة زوايا للدفتر</span>
              <input
                ref={fileUploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                multiple
                disabled={analyzing || processingFrames}
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <AnimatePresence>
          {cameraActive && (
            <motion.div
              key="burst-camera-viewfinder"
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mt-3 space-y-3"
            >
              <div className="relative overflow-hidden rounded-xl border bg-black" style={{ borderColor: 'var(--accent)' }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="max-h-[420px] w-full object-contain"
                />
                {/* Ledger alignment frame guide */}
                <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed border-white/60" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {scanMode === 'fast'
                    ? 'التقط صورة واضحة وسيتم إرسالها تلقائيًا وعرض الجدول فورًا.'
                    : 'وجّه الكاميرا عموديًا فوق جدول الدفتر، ثم اضغط ضغطة واحدة لالتقاط 4 إطارات متتالية لإزالة التغبيش والظلال.'}
                </div>
                <motion.button
                  type="button"
                  disabled={capturingBurst || processingFrames}
                  onClick={captureBurstFromVideo}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'var(--success-fg)',
                  }}
                >
                  {capturingBurst ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        جارٍ الالتقاط ({burstProgress}/{scanMode === 'fast' ? 1 : 4})...
                      </span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      <span>
                        {scanMode === 'fast'
                          ? 'لقطة سريعة وتحليل مباشر'
                          : 'التقاط سلسلة متتالية (Burst 4 إطارات)'}
                      </span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {processingFrames && (
            <motion.div
              key="burst-processing-frames"
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mt-3 flex items-center gap-2 text-xs font-bold"
              style={{ color: 'var(--accent)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                جارٍ تصحيح ميلان الصفحة، تنقية الخلفية الورقية، وفحص الحدة لكل إطار...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {cameraError && (
            <motion.div
              key="burst-camera-error"
              role="alert"
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
            >
              <span>{cameraError}</span>
              <button
                type="button"
                onClick={() =>
                  setPermissionGuide(buildPermissionRecoveryGuide('camera', cameraError))
                }
                className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                عرض خطوات السماح بالكاميرا
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Burst Quality Gate Rejection OR Preprocessed Frame Strip */}
      <AnimatePresence>
        {burstSummary && (
          <motion.div
            key="burst-summary-card"
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-3 rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: burstSummary.rejected
                ? 'var(--danger)'
                : 'var(--success)',
            }}
          >
          {burstSummary.rejected ? (
            <div role="alert" className="space-y-2" style={{ color: 'var(--danger)' }}>
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <span>
                  بوابة الفحص المسبق: تم رفض اللقطات محليًا قبل الإرسال (الجودة:{' '}
                  {burstSummary.averageQualityScore}%)
                </span>
              </div>
              <ul className="list-disc space-y-1 pr-5 text-xs font-semibold">
                {burstSummary.rejectionReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--success)' }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{burstSummary.enhancementReport}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEnhancedPreview((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>
                      {showEnhancedPreview
                        ? 'عرض الأصل قبل التنقية'
                        : 'عرض النسخة المنقاة'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBurstSummary(null)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>إعادة الالتقاط</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {burstSummary.frames.map((frame) => (
                  <div
                    key={frame.id}
                    className="overflow-hidden rounded-lg border p-2 text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: frame.metrics.isAcceptable
                        ? 'var(--border-color)'
                        : 'var(--danger)',
                    }}
                  >
                    <img
                      src={
                        showEnhancedPreview
                          ? frame.enhancedPreviewUrl
                          : frame.rawPreviewUrl
                      }
                      alt={frame.label}
                      className="h-28 w-full rounded object-cover"
                    />
                    <div className="mt-1.5 flex items-center justify-between font-bold tabular-nums">
                      <span>{frame.label}</span>
                      <span
                        style={{
                          color: frame.metrics.isAcceptable
                            ? 'var(--success)'
                            : 'var(--danger)',
                        }}
                      >
                        {frame.metrics.overallQualityScore}%
                      </span>
                    </div>
                    <div
                      className="mt-0.5 tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      حدة: {frame.metrics.sharpnessScore}% · ميلان:{' '}
                      {frame.skewAngleDeg}°
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => onBurstReadyAndAnalyze(burstSummary)}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جارٍ دمج اللقطات واستخراج الحقول الأربعة...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>
                        دمج ({burstSummary.acceptedFrames.length}) إطارات واستخراج
                        البيانات
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      <PermissionGuardModal
        open={Boolean(permissionGuide)}
        guide={permissionGuide}
        checking={checkingPermission}
        onClose={() => setPermissionGuide(null)}
        onRetryPermission={() => void startCamera()}
        onUseFallback={() => fileUploadInputRef.current?.click()}
        fallbackLabel="رفع صور الدفتر من الجهاز"
      />
    </div>
  );
};
