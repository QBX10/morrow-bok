import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Music, Pause, Play, RefreshCw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  getBackgroundMusicSnapshot,
  subscribeBackgroundMusic,
} from '../../utils/backgroundMusicEngine';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import { audioManager } from '../../services/audio/AudioManager';

interface BackgroundMusicControlProps {
  variant?: 'topbar' | 'floating';
  className?: string;
}

export const BackgroundMusicControl: React.FC<BackgroundMusicControlProps> = ({
  variant = 'topbar',
  className = '',
}) => {
  const snapshot = useSyncExternalStore(
    subscribeBackgroundMusic,
    getBackgroundMusicSnapshot,
    getBackgroundMusicSnapshot
  );

  const [open, setOpen] = useState(false);
  const lastNonZeroVolumeRef = useRef(snapshot.volume > 0.04 ? snapshot.volume : 0.2);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useTabrixReducedMotion();

  useEffect(() => {
    if (snapshot.volume > 0.04) {
      lastNonZeroVolumeRef.current = snapshot.volume;
    }
  }, [snapshot.volume]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const isAudiblyActive =
    !snapshot.userPaused &&
    !snapshot.pauseReason &&
    snapshot.isPlaying &&
    snapshot.volume > 0.005;

  const isAutoPaused = !snapshot.userPaused && Boolean(snapshot.pauseReason);
  const volumePercent = Math.round(snapshot.volume * 100);

  const statusText = snapshot.usingSynthFallback
    ? 'نغمة هادئة احتياطية (بدون اتصال)'
    : snapshot.hasError
    ? 'تعذر تحميل المسار الصوتي'
    : snapshot.userPaused
    ? 'متوقفة يدوياً'
    : snapshot.pauseReasonLabel
    ? snapshot.pauseReasonLabel
    : snapshot.awaitingGesture
    ? 'تبدأ تلقائياً عند أول تفاعل'
    : snapshot.volume <= 0.005
    ? 'مستوى الصوت مكتوم'
    : 'تعمل بهدوء في الخلفية';

  const handleTogglePlay = () => {
    const nextMusicEnabled = snapshot.userPaused;
    audioManager.playEvent(nextMusicEnabled ? 'toggle_on' : 'toggle_off', {
      bypassPrefGate: true,
    });
    audioManager.updateSettings(
      { musicEnabled: nextMusicEnabled },
      { showLocalToast: false }
    );
  };

  const handleToggleMute = () => {
    const nextVol =
      snapshot.volume > 0.01
        ? (() => {
            lastNonZeroVolumeRef.current = snapshot.volume;
            return 0;
          })()
        : lastNonZeroVolumeRef.current || 0.2;
    audioManager.updateSettings(
      { musicVolume: nextVol },
      { debounceSyncMs: 200, showLocalToast: false }
    );
  };

  const isFloating = variant === 'floating';

  return (
    <div
      ref={wrapRef}
      className={
        isFloating
          ? `no-print fixed bottom-4 left-4 z-[160] ${className}`
          : `relative ${className}`
      }
    >
      <motion.button
        type="button"
        onClick={() => {
          audioManager.playEvent(open ? 'menu_close' : 'menu_open');
          setOpen((prev) => !prev);
        }}
        whileHover={reducedMotion ? undefined : { scale: 1.02 }}
        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
        transition={TABRIX_TACTILE_SPRING}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="التحكم في موسيقى الخلفية"
        title={statusText}
        data-testid="bg-music-trigger"
        className={
          isFloating
            ? 'smoked-glass-elevated inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold shadow-lg whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer'
        }
        style={{
          backgroundColor: open ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
          borderColor:
            open || isAudiblyActive ? 'var(--accent)' : 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {isAudiblyActive ? (
          <span
            aria-hidden="true"
            className="inline-flex h-3.5 items-end gap-[2px] px-0.5"
          >
            <span
              className={`w-[2.5px] h-3 rounded-sm ${reducedMotion ? '' : 'morrow-eq-bar'}`}
              style={{ backgroundColor: 'var(--accent)', animationDelay: '0ms' }}
            />
            <span
              className={`w-[2.5px] h-2 rounded-sm ${reducedMotion ? '' : 'morrow-eq-bar'}`}
              style={{ backgroundColor: 'var(--accent)', animationDelay: '180ms' }}
            />
            <span
              className={`w-[2.5px] h-3.5 rounded-sm ${reducedMotion ? '' : 'morrow-eq-bar'}`}
              style={{ backgroundColor: 'var(--accent)', animationDelay: '340ms' }}
            />
          </span>
        ) : snapshot.userPaused || snapshot.volume <= 0.005 ? (
          <VolumeX
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: 'var(--text-muted)' }}
          />
        ) : (
          <Music
            className="h-3.5 w-3.5 shrink-0"
            style={{
              color: isAutoPaused ? 'var(--warning, #d97706)' : 'var(--accent)',
            }}
          />
        )}

        <span className="hidden xl:inline text-[11px] font-bold">
          {snapshot.userPaused
            ? 'صامت'
            : isAutoPaused
            ? 'مؤقت'
            : 'الموسيقى'}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="bg-music-popover"
            role="dialog"
            aria-label="لوحة التحكم بموسيقى الخلفية"
            variants={
              reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS
            }
            initial="initial"
            animate="animate"
            exit="exit"
            className={`smoked-glass-elevated absolute left-0 z-50 w-72 max-w-[90vw] rounded-2xl border p-3.5 shadow-xl ${
              isFloating ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              transformOrigin: isFloating ? 'bottom left' : 'top left',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  موسيقى الخلفية
                </div>
                <div
                  className="mt-0.5 truncate text-[11px]"
                  style={{
                    color: isAutoPaused
                      ? 'var(--warning, #d97706)'
                      : 'var(--text-muted)',
                  }}
                >
                  {statusText}
                </div>
              </div>

              <button
                type="button"
                onClick={handleTogglePlay}
                data-testid="bg-music-play-toggle"
                aria-label={
                  snapshot.userPaused
                    ? 'تشغيل موسيقى الخلفية'
                    : 'إيقاف موسيقى الخلفية مؤقتاً'
                }
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: snapshot.userPaused
                    ? 'var(--accent)'
                    : 'var(--bg-main)',
                  color: snapshot.userPaused
                    ? 'var(--accent-fg)'
                    : 'var(--text-primary)',
                  border: snapshot.userPaused
                    ? 'none'
                    : '1px solid var(--border-color)',
                }}
              >
                {snapshot.userPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>تشغيل</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>إيقاف</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t space-y-2.5" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="inline-flex items-center gap-1.5 font-bold hover:opacity-80 cursor-pointer whitespace-nowrap"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label={snapshot.volume > 0 ? 'كتم الصوت' : 'إعادة الصوت'}
                >
                  {snapshot.volume <= 0.01 ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--accent)' }}
                    />
                  )}
                  <span>مستوى الصوت</span>
                </button>
                <span
                  className="font-mono text-[11px] font-bold tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {volumePercent}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volumePercent}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  const nextVol = pct / 100;
                  audioManager.updateSettings(
                    { musicVolume: nextVol },
                    { debounceSyncMs: 320, showLocalToast: false }
                  );
                }}
                aria-label="مستوى صوت موسيقى الخلفية"
                data-testid="bg-music-volume-slider"
                className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
              />

              <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                  <span>التوقف الذكي التلقائي</span>
                </span>
                <input
                  type="checkbox"
                  checked={snapshot.smartModeEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    audioManager.playEvent(next ? 'toggle_on' : 'toggle_off', {
                      bypassPrefGate: true,
                    });
                    audioManager.updateSettings(
                      { smartPauseEnabled: next },
                      { showLocalToast: false }
                    );
                  }}
                  aria-label="التوقف الذكي التلقائي للموسيقى"
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                  إيقاف عند الخروج من التطبيق
                </span>
                <input
                  type="checkbox"
                  checked={snapshot.pauseOnExit}
                  onChange={(e) => {
                    const next = e.target.checked;
                    audioManager.playEvent(next ? 'toggle_on' : 'toggle_off', {
                      bypassPrefGate: true,
                    });
                    audioManager.updateSettings(
                      { pauseOnExit: next },
                      { showLocalToast: false }
                    );
                  }}
                  aria-label="إيقاف الموسيقى عند الخروج من التطبيق"
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
                />
              </label>

              {(snapshot.hasError || snapshot.awaitingGesture || snapshot.usingSynthFallback) && !snapshot.userPaused && (
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playEvent('click', { bypassPrefGate: true });
                    audioManager.retryMusic();
                  }}
                  className="flex w-full h-8 items-center justify-center gap-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{snapshot.awaitingGesture ? 'تنشيط الصوت الآن' : 'إعادة تحميل المسار الأصلي'}</span>
                </button>
              )}
            </div>

            <div
              className="mt-2.5 text-[10px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              تتوقف تلقائياً عند استخدام الميكروفون أو الكاميرا أو القراءة الصوتية أو فصل السماعة وتعود فقط بعد انتهاء كل الأسباب.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
