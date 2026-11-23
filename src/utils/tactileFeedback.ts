// Optional micro tactile & soft WebAudio feedback (purely opt-in and respects reduced motion)

let sharedAudioCtx: AudioContext | null = null;

export function playTactileFeedback(
  kind: 'tap' | 'success' | 'warn' | 'undo' = 'tap',
  options?: {
    haptic?: boolean;
    sound?: boolean;
    reduceMotion?: boolean;
  }
): void {
  if (options?.reduceMotion) return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  if (options?.haptic && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const pattern =
        kind === 'success' ? [8, 25, 10] : kind === 'warn' ? [18, 25, 18] : 6;
      navigator.vibrate(pattern);
    } catch {
      // ignore unsupported vibration environments
    }
  }

  if (options?.sound && typeof window !== 'undefined') {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      if (sharedAudioCtx.state === 'suspended') {
        void sharedAudioCtx.resume();
      }
      const now = sharedAudioCtx.currentTime;
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = 'sine';
      const freq =
        kind === 'success'
          ? 640
          : kind === 'undo'
          ? 420
          : kind === 'warn'
          ? 310
          : 520;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore WebAudio autoplay restrictions
    }
  }
}
