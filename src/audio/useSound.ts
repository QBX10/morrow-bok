import { useCallback, useEffect, useState } from 'react';
import { soundManager, type NotificationChannelKey, type PauseReason } from './SoundManager';
import type { SoundEventId } from './soundMap';
import type { SoundPaletteId } from '../theme/tokens';

const CHANNEL_EVENT_MAP: Record<NotificationChannelKey, SoundEventId> = {
  security: 'notify_security',
  reminders: 'notify_reminders',
  sync: 'notify_sync',
  news: 'notify_news',
};

export interface TorchControllerResult {
  on: boolean;
  hardwareSupported: boolean;
  fallbackMode: 'hardware' | 'capacitor' | 'screen_glow';
}

export function useSound() {
  const [pauseReasons, setPauseReasons] = useState<PauseReason[]>(() =>
    soundManager.getPauseReasons()
  );
  const [musicPlaying, setMusicPlaying] = useState<boolean>(() =>
    soundManager.isMusicPlaying()
  );
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [flashlightMode, setFlashlightMode] = useState<'hardware' | 'capacitor' | 'screen_glow'>('screen_glow');
  const [torchStream, setTorchStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const cleanupLifecycle = soundManager.installLifecycleMonitors();
    const unsub = soundManager.subscribe(() => {
      setPauseReasons(soundManager.getPauseReasons());
      setMusicPlaying(soundManager.isMusicPlaying());
    });
    return () => {
      cleanupLifecycle();
      unsub();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (torchStream) {
        torchStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [torchStream]);

  const play = useCallback(
    (
      eventId: SoundEventId,
      options?: { paletteOverride?: SoundPaletteId; forceSound?: boolean }
    ) => {
      soundManager.unlockOnGesture();
      return soundManager.play(eventId, options);
    },
    []
  );

  const playChannelNotify = useCallback(
    (channel: NotificationChannelKey, forceSound = false) => {
      soundManager.unlockOnGesture();
      return soundManager.play(CHANNEL_EVENT_MAP[channel], { forceSound });
    },
    []
  );

  const toggleMusic = useCallback(() => {
    soundManager.unlockOnGesture();
    const next = !soundManager.isMusicEnabled();
    soundManager.setMusicEnabled(next);
    soundManager.play(next ? 'toggle_on' : 'toggle_off');
    return next;
  }, []);

  const toggleFlashlight = useCallback(async (): Promise<TorchControllerResult> => {
    soundManager.unlockOnGesture();
    const nextState = !flashlightOn;

    // 1. Check Capacitor Torch bridge if running inside Capacitor shell
    const capTorch = (
      window as unknown as {
        Capacitor?: {
          Plugins?: {
            Torch?: { enable?: () => Promise<void>; disable?: () => Promise<void> };
          };
        };
      }
    )?.Capacitor?.Plugins?.Torch;

    if (capTorch?.enable && capTorch?.disable) {
      try {
        if (nextState) await capTorch.enable();
        else await capTorch.disable();
        setFlashlightOn(nextState);
        setFlashlightMode('capacitor');
        soundManager.play(nextState ? 'flashlight_on' : 'flashlight_off');
        return { on: nextState, hardwareSupported: true, fallbackMode: 'capacitor' };
      } catch {
        // continue to Web MediaTrackConstraints
      }
    }

    // 2. Try MediaTrackConstraints torch on mobile browsers (Android Chrome / WebRTC)
    if (!nextState && torchStream) {
      torchStream.getTracks().forEach((t) => t.stop());
      setTorchStream(null);
      setFlashlightOn(false);
      soundManager.play('flashlight_off');
      return { on: false, hardwareSupported: flashlightMode === 'hardware', fallbackMode: flashlightMode };
    }

    if (nextState && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        if (track && caps?.torch) {
          await track.applyConstraints({
            advanced: [{ torch: true } as MediaTrackConstraintSet],
          });
          setTorchStream(stream);
          setFlashlightOn(true);
          setFlashlightMode('hardware');
          soundManager.play('flashlight_on');
          return { on: true, hardwareSupported: true, fallbackMode: 'hardware' };
        }
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Hardware torch unavailable or permission denied -> clean software torch screen fallback
      }
    }

    setFlashlightOn(nextState);
    setFlashlightMode('screen_glow');
    soundManager.play(nextState ? 'flashlight_on' : 'flashlight_off');
    return { on: nextState, hardwareSupported: false, fallbackMode: 'screen_glow' };
  }, [flashlightOn, flashlightMode, torchStream]);

  return {
    play,
    playChannelNotify,
    toggleMusic,
    toggleFlashlight,
    flashlightOn,
    flashlightMode,
    musicPlaying,
    pauseReasons,
    addPauseReason: (r: PauseReason) => soundManager.addPauseReason(r),
    removePauseReason: (r: PauseReason) => soundManager.removePauseReason(r),
  };
}
