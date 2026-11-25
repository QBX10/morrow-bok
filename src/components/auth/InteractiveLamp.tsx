import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  playTactileFeedback,
  resumeSharedAudioContext,
} from '../../utils/tactileFeedback';
import type { LampShaderPhysicsState } from './LampRaymarchShader';

interface InteractiveLampProps {
  isOn: boolean;
  onToggleLamp: (nextState: boolean) => void;
  onPullProgress?: (progress: number) => void;
  focusBoost?: boolean;
  reducedMotion?: boolean;
  apertureRef?: React.RefObject<HTMLSpanElement | null>;
  physicsRef?: React.MutableRefObject<LampShaderPhysicsState>;
}

const PULL_TRIGGER_THRESHOLD = 22;
const MAX_PULL_DISTANCE = 50;
const CORD_BASE_LENGTH = 90;
const CORD_NOTCH_PX = 9;

// Left-mounted cantilever studio lamp proportions (viewBox 320 x 380)
const VIEWBOX_W = 320;
const VIEWBOX_H = 380;
const PIVOT_X = 178;
const PIVOT_Y = 74;
const MOUTH_LOCAL_Y = 76;

function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export const InteractiveLamp: React.FC<InteractiveLampProps> = ({
  isOn,
  onToggleLamp,
  onPullProgress,
  focusBoost = false,
  reducedMotion = false,
  apertureRef,
  physicsRef,
}) => {
  const isDesktop = useIsDesktopViewport();
  const dipTimeoutRef = useRef<number | null>(null);
  const swayTimeoutRef = useRef<number | null>(null);
  const recoilTimeoutRef = useRef<number | null>(null);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    startTime: number;
    maxDelta: number;
    lastNotch: number;
    armedSoundPlayed: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    startTime: 0,
    maxDelta: 0,
    lastNotch: 0,
    armedSoundPlayed: false,
  });

  const [pullYState, setPullYState] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Left-mounted lamp swivels counter-clockwise (-44deg) on desktop to aim down-right at the login panel
  const targetHeadAngle = isOn ? (isDesktop ? -44 : 0) : isDesktop ? -14 : 0;

  // Multi-stage Framer Motion physical spring system
  const rawHeadAngle = useMotionValue(targetHeadAngle);
  const rawHeadRecoil = useMotionValue(0);
  const rawArmDipY = useMotionValue(0);
  const rawPullY = useMotionValue(0);
  const rawSwayX = useMotionValue(0);

  const springHeadAngle = useSpring(
    rawHeadAngle,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 155, damping: 18, mass: 0.95 }
  );
  const springHeadRecoil = useSpring(
    rawHeadRecoil,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 260, damping: 13, mass: 0.7 }
  );
  const springArmDipY = useSpring(
    rawArmDipY,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 320, damping: 16, mass: 0.75 }
  );
  const springPullY = useSpring(
    rawPullY,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 420, damping: 14, mass: 0.58 }
  );

  // Coupled double-pendulum cord sway (tip lags mid-cord for true whip/catenary inertia)
  const springMidSwayX = useSpring(
    rawSwayX,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 190, damping: 6.4, mass: 0.65 }
  );
  const springSwayX = useSpring(
    rawSwayX,
    reducedMotion
      ? { stiffness: 1400, damping: 100 }
      : { stiffness: 118, damping: 4.6, mass: 0.92 }
  );

  const combinedHeadAngle = useTransform(
    [springHeadAngle, springHeadRecoil],
    ([angle, recoil]: number[]) => angle + recoil
  );

  // Stream live physical telemetry into GPU WebGL Raymarch Shader with zero React re-renders
  useMotionValueEvent(springSwayX, 'change', (sx) => {
    if (physicsRef) {
      physicsRef.current.cordSwayNorm = Math.max(-1, Math.min(1, sx / 26));
    }
  });
  useMotionValueEvent(springPullY, 'change', (py) => {
    if (physicsRef) {
      physicsRef.current.cordPullNorm = Math.max(
        0,
        Math.min(1, py / PULL_TRIGGER_THRESHOLD)
      );
    }
  });
  useMotionValueEvent(combinedHeadAngle, 'change', (deg) => {
    if (physicsRef) {
      physicsRef.current.headAngleDeg = deg;
    }
  });

  // Exact world coordinates of the lamp mouth center including swivel + arm flex dip
  const cordOriginX = useTransform(combinedHeadAngle, (deg) => {
    const rad = (deg * Math.PI) / 180;
    return PIVOT_X - MOUTH_LOCAL_Y * Math.sin(rad);
  });
  const cordOriginY = useTransform(
    [combinedHeadAngle, springArmDipY],
    ([deg, dip]: number[]) => {
      const rad = (deg * Math.PI) / 180;
      return PIVOT_Y + dip + MOUTH_LOCAL_Y * Math.cos(rad);
    }
  );

  // Live dome center for synced clickable hit target
  const domeLeftPct = useTransform(combinedHeadAngle, (deg) => {
    const rad = (deg * Math.PI) / 180;
    const x = PIVOT_X - 42 * Math.sin(rad);
    return `${(x / VIEWBOX_W) * 100}%`;
  });
  const domeTopPct = useTransform(
    [combinedHeadAngle, springArmDipY],
    ([deg, dip]: number[]) => {
      const rad = (deg * Math.PI) / 180;
      const y = PIVOT_Y + dip + 42 * Math.cos(rad);
      return `${(y / VIEWBOX_H) * 100}%`;
    }
  );

  // Cubic Bezier catenary pull-chain combining mid-cord whip and tip pendulum inertia
  const cordPathD = useTransform(
    [springPullY, springMidSwayX, springSwayX],
    ([py, midSx, tipSx]: number[]) => {
      const endY = CORD_BASE_LENGTH + Math.max(-5, py);
      const c1x = midSx * 0.24;
      const c1y = endY * 0.32;
      const c2x = midSx * 0.68 + (tipSx - midSx) * 0.22;
      const c2y = endY * 0.68;
      return `M 0 0 C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${tipSx.toFixed(2)} ${endY.toFixed(2)}`;
    }
  );

  const handleY = useTransform(
    springPullY,
    (py) => CORD_BASE_LENGTH + Math.max(-5, py)
  );
  const handleTiltDeg = useTransform(
    [springSwayX, springMidSwayX],
    ([tipSx, midSx]: number[]) => -(tipSx - midSx * 0.35) * 0.72
  );

  // Sync interactive grab button & shader aperture anchor over the live center-mouth cord anchor
  const hitLeftPct = useTransform(
    cordOriginX,
    (x) => `${(x / VIEWBOX_W) * 100}%`
  );
  const hitTopPct = useTransform(
    cordOriginY,
    (y) => `${(y / VIEWBOX_H) * 100}%`
  );

  // Upper boom flex path synced to springArmDipY
  const upperBoomD = useTransform(
    springArmDipY,
    (dip) => `M 76 198 L ${PIVOT_X} ${(PIVOT_Y + dip).toFixed(2)}`
  );
  const pivotCircleY = useTransform(springArmDipY, (dip) => PIVOT_Y + dip);
  const headGroupTransformY = useTransform(springArmDipY, (dip) => dip);

  // Sound is always active automatically (no mute button per user spec)
  const isMuted = false;

  useEffect(() => {
    rawHeadAngle.set(targetHeadAngle);
    if (physicsRef) {
      physicsRef.current.headAngleDeg = targetHeadAngle;
    }
  }, [physicsRef, rawHeadAngle, targetHeadAngle]);

  useEffect(() => {
    return () => {
      if (dipTimeoutRef.current !== null) {
        window.clearTimeout(dipTimeoutRef.current);
      }
      if (swayTimeoutRef.current !== null) {
        window.clearTimeout(swayTimeoutRef.current);
      }
      if (recoilTimeoutRef.current !== null) {
        window.clearTimeout(recoilTimeoutRef.current);
      }
    };
  }, []);

  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    return resumeSharedAudioContext();
  }, []);

  const playLampHum = useCallback(
    async (turningOn: boolean) => {
      const audioCtx = await ensureAudioContext();
      if (!audioCtx || isMuted) return;

      const now = audioCtx.currentTime;

      if (turningOn) {
        const snap = audioCtx.createOscillator();
        const snapGain = audioCtx.createGain();
        snap.type = 'triangle';
        snap.frequency.setValueAtTime(285, now);
        snap.frequency.exponentialRampToValueAtTime(780, now + 0.026);
        snapGain.gain.setValueAtTime(0.001, now);
        snapGain.gain.linearRampToValueAtTime(0.045, now + 0.005);
        snapGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.036);
        snap.connect(snapGain);
        snapGain.connect(audioCtx.destination);
        snap.start(now);
        snap.stop(now + 0.042);

        const hum = audioCtx.createOscillator();
        const humGain = audioCtx.createGain();
        hum.type = 'sine';
        hum.frequency.setValueAtTime(68, now + 0.02);
        hum.frequency.exponentialRampToValueAtTime(148, now + 0.16);
        hum.frequency.exponentialRampToValueAtTime(120, now + 0.36);

        humGain.gain.setValueAtTime(0.001, now);
        humGain.gain.linearRampToValueAtTime(0.065, now + 0.08);
        humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.39);

        hum.connect(humGain);
        humGain.connect(audioCtx.destination);
        hum.start(now + 0.02);
        hum.stop(now + 0.42);

        const shimmer = audioCtx.createOscillator();
        const shimmerGain = audioCtx.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(136, now + 0.02);
        shimmer.frequency.exponentialRampToValueAtTime(296, now + 0.16);
        shimmer.frequency.exponentialRampToValueAtTime(240, now + 0.34);

        shimmerGain.gain.setValueAtTime(0.0005, now + 0.02);
        shimmerGain.gain.linearRampToValueAtTime(0.016, now + 0.09);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);

        shimmer.connect(shimmerGain);
        shimmerGain.connect(audioCtx.destination);
        shimmer.start(now + 0.02);
        shimmer.stop(now + 0.38);
      } else {
        const releaseSnap = audioCtx.createOscillator();
        const releaseGain = audioCtx.createGain();
        releaseSnap.type = 'triangle';
        releaseSnap.frequency.setValueAtTime(520, now);
        releaseSnap.frequency.exponentialRampToValueAtTime(205, now + 0.028);
        releaseGain.gain.setValueAtTime(0.001, now);
        releaseGain.gain.linearRampToValueAtTime(0.036, now + 0.004);
        releaseGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.036);
        releaseSnap.connect(releaseGain);
        releaseGain.connect(audioCtx.destination);
        releaseSnap.start(now);
        releaseSnap.stop(now + 0.042);

        const powerDown = audioCtx.createOscillator();
        const powerDownGain = audioCtx.createGain();
        powerDown.type = 'sine';
        powerDown.frequency.setValueAtTime(138, now + 0.015);
        powerDown.frequency.exponentialRampToValueAtTime(56, now + 0.19);
        powerDownGain.gain.setValueAtTime(0.001, now + 0.015);
        powerDownGain.gain.linearRampToValueAtTime(0.038, now + 0.04);
        powerDownGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.21);
        powerDown.connect(powerDownGain);
        powerDownGain.connect(audioCtx.destination);
        powerDown.start(now + 0.015);
        powerDown.stop(now + 0.23);
      }
    },
    [ensureAudioContext, isMuted]
  );

  const pulseCordSway = useCallback(
    (impulsePx: number) => {
      if (swayTimeoutRef.current !== null) {
        window.clearTimeout(swayTimeoutRef.current);
        swayTimeoutRef.current = null;
      }
      if (reducedMotion || impulsePx === 0) {
        rawSwayX.set(0);
        return;
      }
      rawSwayX.set(impulsePx);
      swayTimeoutRef.current = window.setTimeout(() => {
        rawSwayX.set(0);
        swayTimeoutRef.current = null;
      }, 95);
    },
    [rawSwayX, reducedMotion]
  );

  const pulseHeadRecoil = useCallback(
    (recoilDeg: number, dipPx = 3.2) => {
      if (recoilTimeoutRef.current !== null) {
        window.clearTimeout(recoilTimeoutRef.current);
        recoilTimeoutRef.current = null;
      }
      if (reducedMotion) {
        rawHeadRecoil.set(0);
        rawArmDipY.set(0);
        return;
      }
      rawHeadRecoil.set(recoilDeg);
      rawArmDipY.set(dipPx);
      recoilTimeoutRef.current = window.setTimeout(() => {
        rawHeadRecoil.set(0);
        rawArmDipY.set(0);
        recoilTimeoutRef.current = null;
      }, 135);
    },
    [rawArmDipY, rawHeadRecoil, reducedMotion]
  );

  const triggerLampToggle = useCallback(
    (withDipAnimation: boolean, releaseImpulsePx?: number) => {
      const turningOn = !isOn;
      if (dipTimeoutRef.current !== null) {
        window.clearTimeout(dipTimeoutRef.current);
        dipTimeoutRef.current = null;
      }

      const defaultImpulse = turningOn ? (isDesktop ? -18 : 12) : isDesktop ? 15 : -11;

      if (withDipAnimation && !reducedMotion) {
        setPullYState(24);
        onPullProgress?.(0.5);
        animate(rawPullY, 24, {
          type: 'spring',
          stiffness: 650,
          damping: 22,
        });
        pulseHeadRecoil(turningOn ? -4.2 : 3.0, 3.8);
        pulseCordSway(releaseImpulsePx ?? defaultImpulse);
        dipTimeoutRef.current = window.setTimeout(() => {
          setPullYState(0);
          rawPullY.set(0);
          onPullProgress?.(0);
          dipTimeoutRef.current = null;
        }, 125);
      } else {
        setPullYState(0);
        rawPullY.set(0);
        onPullProgress?.(0);
        pulseHeadRecoil(turningOn ? -3.4 : 2.4, 2.8);
        pulseCordSway(releaseImpulsePx ?? defaultImpulse);
      }

      void playLampHum(turningOn);
      onToggleLamp(turningOn);
    },
    [
      isDesktop,
      isOn,
      onPullProgress,
      onToggleLamp,
      playLampHum,
      pulseCordSway,
      pulseHeadRecoil,
      rawPullY,
      reducedMotion,
    ]
  );

  const handleCordPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    void ensureAudioContext();
    const now = performance.now();
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: now,
      velocityX: 0,
      startTime: now,
      maxDelta: 0,
      lastNotch: 0,
      armedSoundPlayed: false,
    };
    setIsDragging(true);
  };

  const handleCordPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dt = Math.max(4, now - drag.lastTime);
    const instVx = ((e.clientX - drag.lastX) / dt) * 16;
    drag.velocityX = drag.velocityX * 0.6 + instVx * 0.4;
    drag.lastX = e.clientX;
    drag.lastTime = now;

    const rawDown = Math.max(0, e.clientY - drag.startY);
    const dampedY =
      MAX_PULL_DISTANCE * (1 - Math.exp(-rawDown / (MAX_PULL_DISTANCE * 0.92)));
    const rawDX = e.clientX - drag.startX;
    const dampedX = reducedMotion
      ? 0
      : Math.max(-26, Math.min(26, rawDX * 0.48));

    drag.maxDelta = Math.max(drag.maxDelta, dampedY);

    const notch = Math.floor(dampedY / CORD_NOTCH_PX);
    if (notch !== drag.lastNotch && notch > 0) {
      drag.lastNotch = notch;
      playTactileFeedback('cord_tick', {
        sound: true,
        haptic: true,
        frequencyPitch: 245 + notch * 46,
      });
    }

    if (dampedY >= PULL_TRIGGER_THRESHOLD && !drag.armedSoundPlayed) {
      drag.armedSoundPlayed = true;
      playTactileFeedback('tap', {
        sound: true,
        haptic: true,
        frequencyPitch: 620,
      });
    } else if (dampedY < PULL_TRIGGER_THRESHOLD - 4) {
      drag.armedSoundPlayed = false;
    }

    rawPullY.set(dampedY);
    rawSwayX.set(dampedX);
    if (!reducedMotion) {
      const ratio = dampedY / MAX_PULL_DISTANCE;
      rawHeadRecoil.set(-ratio * 4.6);
      rawArmDipY.set(ratio * 4.4);
    }
    setPullYState(dampedY);
    onPullProgress?.(Math.min(1, dampedY / PULL_TRIGGER_THRESHOLD));
  };

  const finishCordPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    drag.active = false;
    drag.pointerId = null;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore capture release failures
    }

    const elapsed = performance.now() - drag.startTime;
    const pulledEnough = pullYState >= PULL_TRIGGER_THRESHOLD;
    const wasTap = drag.maxDelta < 7 && elapsed < 360;
    const currentSway = rawSwayX.get();
    const momentumKick = Math.max(-18, Math.min(18, drag.velocityX * 1.15));
    const swayImpulse =
      Math.abs(currentSway) > 3.5 || Math.abs(momentumKick) > 3
        ? -currentSway * 0.85 + momentumKick * 0.5
        : pulledEnough
        ? isOn
          ? 16
          : -18
        : 0;

    if (pulledEnough) {
      triggerLampToggle(false, swayImpulse);
    } else if (wasTap) {
      triggerLampToggle(true);
    } else {
      setPullYState(0);
      rawPullY.set(0);
      rawHeadRecoil.set(0);
      rawArmDipY.set(0);
      pulseCordSway(swayImpulse || (drag.maxDelta > 4 ? -8.5 : 0));
      onPullProgress?.(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerLampToggle(true);
    }
  };

  const cordArmed = pullYState >= PULL_TRIGGER_THRESHOLD;
  const pullProgress = Math.min(1, pullYState / PULL_TRIGGER_THRESHOLD);
  const bulbWarmth = isOn ? (focusBoost ? 1 : 0.94) : pullProgress * 0.4;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Precision Left-Side Cantilever Studio Lamp + Multi-Stage Physical Pull-Chain */}
      <div className="relative z-10 w-[232px] sm:w-[264px] lg:w-[308px]">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="w-full h-auto overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="studioBrass" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FAF0C2" />
              <stop offset="48%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#7A5B12" />
            </linearGradient>

            <linearGradient id="studioStem" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1B1915" />
              <stop offset="45%" stopColor="#3B3324" />
              <stop offset="100%" stopColor="#0F0E0C" />
            </linearGradient>

            <linearGradient id="shadeOuterOff" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2C2A25" />
              <stop offset="55%" stopColor="#161513" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>

            <linearGradient id="shadeOuterOn" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5C4A24" />
              <stop offset="52%" stopColor="#2A2214" />
              <stop offset="100%" stopColor="#130F09" />
            </linearGradient>

            <radialGradient id="shadeInnerLit" cx="50%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#FFFDF7" stopOpacity="1" />
              <stop offset="36%" stopColor="#FFE99B" stopOpacity="0.88" />
              <stop offset="74%" stopColor="#D4AF37" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#9B7218" stopOpacity="0.08" />
            </radialGradient>

            <radialGradient id="bulbBlackbodyGlow" cx="50%" cy="46%" r="54%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="42%" stopColor="#FFF5CC" />
              <stop offset="82%" stopColor="#F4C95D" />
              <stop offset="100%" stopColor="#C99422" />
            </radialGradient>

            <filter id="lampBeamBlurSoft" x="-40%" y="-20%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id="lampBeamBlurCore" x="-30%" y="-20%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9" />
            </filter>

            <linearGradient id="beamSoftSpread" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF7D8" stopOpacity="0.38" />
              <stop offset="35%" stopColor="#EAC667" stopOpacity="0.14" />
              <stop offset="72%" stopColor="#C89B3C" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="beamFocusedCore" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFDF5" stopOpacity="0.54" />
              <stop offset="42%" stopColor="#F5DA82" stopOpacity="0.16" />
              <stop offset="82%" stopColor="#D4AF37" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>

            <radialGradient id="deskPool" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F5DA82" stopOpacity="0.42" />
              <stop offset="52%" stopColor="#D4AF37" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="baseGroundShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.78" />
              <stop offset="65%" stopColor="#000000" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft Desk Bounce Pool & Feathered Contact Shadow beneath Left Base */}
          <ellipse
            cx="148"
            cy="356"
            rx="148"
            ry="22"
            fill="url(#deskPool)"
            style={{
              opacity: isOn ? 0.92 : 0.1 + pullProgress * 0.22,
              transform: isOn ? 'scale3d(1, 1, 1)' : 'scale3d(0.62, 0.78, 1)',
              transformOrigin: '148px 356px',
              transition: reducedMotion
                ? 'opacity 140ms ease'
                : 'opacity 420ms ease, transform 460ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <ellipse cx="104" cy="357" rx="78" ry="13" fill="url(#baseGroundShadow)" />

          {/* Heavy Turned Architectural Base (anchored cleanly on left at cx=104, cy=350) */}
          <ellipse
            cx="104"
            cy="352"
            rx="60"
            ry="10.5"
            fill="#0A0A0D"
            stroke="url(#studioBrass)"
            strokeOpacity={isOn ? 0.8 : 0.34}
            strokeWidth="1.25"
          />
          <path
            d="M52 349 C52 337, 156 337, 156 349 L146 339 C146 332, 62 332, 62 339 Z"
            fill="url(#studioStem)"
          />
          <ellipse
            cx="104"
            cy="338"
            rx="42"
            ry="6.2"
            fill="#1D1A14"
            stroke="url(#studioBrass)"
            strokeOpacity={isOn ? 0.62 : 0.26}
            strokeWidth="1"
          />
          {/* Machined Brass Base Collar */}
          <rect
            x="93"
            y="326"
            width="22"
            height="10"
            rx="3.4"
            fill="url(#studioBrass)"
            opacity={isOn ? 0.95 : 0.48}
          />

          {/* Lower Articulated Counterweight Post + Secondary Parallel Tension Rod */}
          <path
            d="M 104 328 L 76 198"
            fill="none"
            stroke="url(#studioStem)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 104 328 L 76 198"
            fill="none"
            stroke="url(#studioBrass)"
            strokeOpacity={isOn ? 0.65 : 0.28}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M 111 324 L 84 202"
            fill="none"
            stroke="url(#studioBrass)"
            strokeOpacity={isOn ? 0.42 : 0.16}
            strokeWidth="1.35"
            strokeLinecap="round"
          />

          {/* Upper Cantilever Boom sweeping rightward with live elastic flex */}
          <motion.path
            d={upperBoomD}
            fill="none"
            stroke="url(#studioStem)"
            strokeWidth="9.2"
            strokeLinecap="round"
          />
          <motion.path
            d={upperBoomD}
            fill="none"
            stroke="url(#studioBrass)"
            strokeOpacity={isOn ? 0.72 : 0.28}
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Machined Brass Elbow Knuckle & Tension Screw */}
          <circle
            cx="76"
            cy="198"
            r="8.2"
            fill="#181510"
            stroke="url(#studioBrass)"
            strokeWidth="1.7"
          />
          <circle cx="76" cy="198" r="3.1" fill="url(#studioBrass)" />

          {/* Swiveling Parabolic Studio Head (pivoting at upper-right yoke 178, 74) */}
          <motion.g
            transform={`translate(${PIVOT_X}, ${PIVOT_Y})`}
            style={{ y: headGroupTransformY }}
          >
            <motion.g
              style={{
                rotate: combinedHeadAngle,
                transformOrigin: '0px 0px',
              }}
            >
              {/* Feathered Local Aperture Beam (bridges seamlessly into GPU GLSL Raymarching Shader) */}
              <motion.g
                initial={false}
                animate={{
                  opacity: isOn
                    ? focusBoost
                      ? 0.88
                      : 0.8
                    : pullProgress * 0.24,
                  scale: isOn ? 1 : 0.84,
                }}
                transition={{
                  duration: reducedMotion ? 0.14 : 0.48,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  transformOrigin: '0px 74px',
                }}
              >
                <path
                  d="M -56 74 L 56 74 C 88 158, 120 234, 138 310 C 54 330, -54 330, -138 310 C -120 234, -88 158, -56 74 Z"
                  fill="url(#beamSoftSpread)"
                  filter="url(#lampBeamBlurSoft)"
                />
                <path
                  d="M -32 74 L 32 74 C 52 148, 70 220, 82 290 C 28 304, -28 304, -82 290 C -70 220, -52 148, -32 74 Z"
                  fill="url(#beamFocusedCore)"
                  filter="url(#lampBeamBlurCore)"
                />
              </motion.g>

              {/* Top Brass Yoke Housing & Cooling Finial */}
              <path
                d="M -13 4 C -13 -9, 13 -9, 13 4 L 16 14 L -16 14 Z"
                fill="url(#studioBrass)"
              />
              <circle cx="0" cy="-10" r="4" fill="url(#studioBrass)" />

              {/* Sculpted Parabolic Reflector Dome */}
              <path
                d="M -18 14 C -37 29, -65 49, -69 74 C -69 81, 69 81, 69 74 C 65 49, 37 29, 18 14 Z"
                fill={isOn ? 'url(#shadeOuterOn)' : 'url(#shadeOuterOff)'}
                stroke="url(#studioBrass)"
                strokeOpacity={isOn ? 0.96 : 0.46}
                strokeWidth="1.5"
                style={{ transition: 'stroke-opacity 300ms ease' }}
              />
              {/* Specular Rib Highlight on Shade */}
              <path
                d="M -15 18 C -31 30, -51 48, -57 68"
                stroke="#FAF0C8"
                strokeOpacity={isOn ? 0.58 : 0.18}
                strokeWidth="1.35"
                strokeLinecap="round"
                fill="none"
              />

              {/* Inner Illuminated Mouth Rim & Glowing Blackbody Tungsten Bulb */}
              <ellipse
                cx="0"
                cy="74"
                rx="68"
                ry="11.5"
                fill="#0B0B0D"
                stroke="url(#studioBrass)"
                strokeOpacity={isOn ? 0.96 : 0.36 + pullProgress * 0.28}
                strokeWidth="1.2"
              />
              <ellipse
                cx="0"
                cy="74"
                rx="68"
                ry="11.5"
                fill="url(#shadeInnerLit)"
                style={{
                  opacity: bulbWarmth,
                  transition: isDragging ? 'none' : 'opacity 280ms ease',
                }}
              />
              <ellipse
                cx="0"
                cy="72"
                rx="14"
                ry="12.5"
                fill={isOn ? 'url(#bulbBlackbodyGlow)' : '#1E1C18'}
                stroke={isOn ? '#FFF4CC' : '#4C4330'}
                strokeWidth="1.1"
                style={{
                  filter: isOn
                    ? 'drop-shadow(0 0 20px rgba(255, 224, 130, 0.98))'
                    : pullProgress > 0.1
                    ? 'drop-shadow(0 0 11px rgba(244, 214, 118, 0.52))'
                    : 'none',
                  transition: 'filter 240ms ease',
                }}
              />
              <path
                d="M -6 70 Q 0 77 6 70"
                fill="none"
                stroke={
                  isOn ? '#FFFFFF' : pullProgress > 0.1 ? '#F9E8A8' : '#7D6A35'
                }
                strokeOpacity={isOn ? 1 : 0.55 + pullProgress * 0.45}
                strokeWidth={isOn ? '2' : '1.3'}
                strokeLinecap="round"
              />

              {/* Center Aperture Brass Pull-Chain Socket Collar ("منتصف الضوء") */}
              <circle
                cx="0"
                cy={MOUTH_LOCAL_Y}
                r="4"
                fill="url(#studioBrass)"
                stroke="#1A140A"
                strokeWidth="0.9"
              />
            </motion.g>
          </motion.g>

          {/* Top Yoke Pivot Pin tracking elastic boom dip */}
          <motion.circle
            cx={PIVOT_X}
            cy={pivotCircleY}
            r="6.2"
            fill="#191611"
            stroke="url(#studioBrass)"
            strokeWidth="1.6"
          />
          <motion.circle
            cx={PIVOT_X}
            cy={pivotCircleY}
            r="2.3"
            fill="url(#studioBrass)"
          />

          {/* Physical Coupled Double-Pendulum Pull-Chain Hanging Vertically Under Gravity */}
          <motion.g style={{ x: cordOriginX, y: cordOriginY }}>
            <circle cx={0} cy={0} r="2.8" fill="#FFF2C2" />

            <motion.path
              d={cordPathD}
              fill="none"
              stroke="url(#studioBrass)"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <motion.path
              d={cordPathD}
              fill="none"
              stroke="#FFF4CC"
              strokeOpacity={isOn || cordArmed ? 0.88 : 0.54}
              strokeWidth="3.5"
              strokeDasharray="0.1 5.5"
              strokeLinecap="round"
            />

            {/* Knurled Brass Plumb-Bob Pull Handle tracking chain end + natural tangent tilt */}
            <motion.g
              style={{
                x: springSwayX,
                y: handleY,
                rotate: handleTiltDeg,
                transformOrigin: '0px 0px',
              }}
            >
              <circle
                cx={0}
                cy={9}
                r={cordArmed ? '15' : '12'}
                fill={
                  cordArmed || isOn
                    ? 'rgba(238, 210, 120, 0.25)'
                    : 'rgba(212, 175, 55, 0.13)'
                }
                style={{ transition: 'fill 200ms ease' }}
              />
              <circle cx={0} cy={1} r="2.6" fill="url(#studioBrass)" />
              <path
                d="M -4.2 3 C -4.2 1.5, 4.2 1.5, 4.2 3 L 4.8 14.5 C 4.8 18.5, -4.8 18.5, -4.8 14.5 Z"
                fill="url(#studioBrass)"
                stroke="#FFF4C8"
                strokeOpacity={cordArmed || isOn ? 0.88 : 0.48}
                strokeWidth="0.95"
                style={{
                  filter:
                    cordArmed || isOn
                      ? 'drop-shadow(0 0 11px rgba(238, 210, 120, 0.85))'
                      : 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.35))',
                }}
              />
              <circle cx={0} cy={12} r="2" fill="#17130A" />
            </motion.g>
          </motion.g>
        </svg>

        {/* Live Aperture Marker for GPU WebGL Raymarch Shader Origin */}
        <motion.span
          ref={apertureRef}
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-3 w-3"
          style={{
            left: hitLeftPct,
            top: hitTopPct,
          }}
        />

        {/* Interactive Hit Target Synced Directly Over the Live Center-Mouth Pull-Chain */}
        <motion.button
          type="button"
          data-testid="lamp-toggle-btn"
          aria-pressed={isOn}
          aria-label={
            isOn
              ? 'اسحب الخيط لإطفاء المصباح'
              : 'اسحب الخيط لتشغيل المصباح وإظهار تسجيل الدخول'
          }
          onPointerDown={handleCordPointerDown}
          onPointerMove={handleCordPointerMove}
          onPointerUp={finishCordPointer}
          onPointerCancel={finishCordPointer}
          onKeyDown={handleKeyDown}
          className="absolute -translate-x-1/2 w-[82px] h-[146px] rounded-full cursor-grab active:cursor-grabbing touch-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          style={{
            left: hitLeftPct,
            top: hitTopPct,
            background: 'transparent',
          }}
        />

        {/* Shade Click Shortcut tracked geometrically to live swiveling dome center */}
        <motion.button
          type="button"
          data-testid="lamp-interactive-hitarea"
          aria-label={isOn ? 'إطفاء المصباح' : 'تشغيل المصباح'}
          onClick={() => triggerLampToggle(true)}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-[138px] h-[74px] rounded-[40px] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          style={{
            left: domeLeftPct,
            top: domeTopPct,
            background: 'transparent',
          }}
        />
      </div>

      {/* Minimal Quiet Pull Instruction Text */}
      <div className="mt-1 text-center space-y-1" dir="rtl">
        <p
          className="text-xs sm:text-sm font-bold tracking-tight transition-colors duration-300"
          style={{
            color: cordArmed
              ? '#FFF2C6'
              : isOn
              ? 'var(--accent-bright, #EED278)'
              : 'var(--text-primary)',
          }}
        >
          {cordArmed
            ? 'أفلت السلسلة الآن...'
            : isOn
            ? 'المصباح مضاء · اسحب السلسلة للإطفاء'
            : 'اسحب السلسلة للأسفل لتشغيل الإضاءة'}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {isOn
            ? 'لوحة تسجيل الدخول مضاءة وجاهزة'
            : 'اسحب السلسلة المتدلية لإنارة لوحة تسجيل الدخول بجانبه'}
        </p>
      </div>
    </div>
  );
};
