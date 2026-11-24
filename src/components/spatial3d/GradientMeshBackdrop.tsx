import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import { buildGradientMeshLayers } from '../../utils/spatial3dConfig';

interface GradientMeshBackdropProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  slideIndex?: number;
  intensity?: 'vibrant' | 'medium' | 'subtle';
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Multi-layered Framer Motion Gradient Mesh & Architectural Caustic Backdrop.
 * Uses GPU-composited transform/opacity keyframes and spring-damped pointer parallax.
 */
export const GradientMeshBackdrop: React.FC<GradientMeshBackdropProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  slideIndex = 0,
  intensity = 'vibrant',
  reduceMotion = false,
  className = '',
}) => {
  const effectivePrefs: Spatial3DPrefs = spatialPrefs || {
    themeId,
    tiltIntensity: 'subtle',
    cardDensity: 'balanced',
  };

  const { palette, orbs } = buildGradientMeshLayers(
    effectivePrefs,
    slideIndex,
    intensity
  );

  // Smooth spring-damped pointer parallax without React re-renders
  const rawPx = useMotionValue(0);
  const rawPy = useMotionValue(0);
  const smoothPx = useSpring(rawPx, { stiffness: 75, damping: 24, mass: 0.9 });
  const smoothPy = useSpring(rawPy, { stiffness: 75, damping: 24, mass: 0.9 });

  const meshShiftX = useTransform(smoothPx, [-1, 1], [-24, 24]);
  const meshShiftY = useTransform(smoothPy, [-1, 1], [-18, 18]);
  const gridShiftX = useTransform(smoothPx, [-1, 1], [14, -14]);
  const gridShiftY = useTransform(smoothPy, [-1, 1], [10, -10]);

  useEffect(() => {
    if (reduceMotion || typeof window === 'undefined') return;
    const onPointerMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      rawPx.set(Math.max(-1, Math.min(1, nx)));
      rawPy.set(Math.max(-1, Math.min(1, ny)));
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [reduceMotion, rawPx, rawPy]);

  return (
    <div
      data-testid="gradient-mesh-backdrop"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* 1. Deep Obsidian Atmospheric Base */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: `radial-gradient(125% 110% at 50% 0%, color-mix(in srgb, ${palette.bgSurface} 76%, #020612) 0%, ${palette.bgMain} 68%, #02050b 100%)`,
        }}
      />

      {/* 2. Pointer-Parallax Framer Motion Gradient Mesh Orbs */}
      <motion.div
        className="absolute inset-[-10%] will-change-transform"
        style={
          reduceMotion
            ? undefined
            : { x: meshShiftX, y: meshShiftY }
        }
      >
        {orbs.map((orb) => (
          <motion.div
            key={orb.id}
            className={`absolute rounded-full will-change-transform ${orb.sizeClass}`}
            style={{
              ...orb.initialPos,
              background: orb.gradient,
              opacity: orb.opacity,
              filter: 'blur(52px)',
            }}
            initial={false}
            animate={
              reduceMotion
                ? { x: 0, y: 0, scale: 1, rotate: 0 }
                : {
                    x: orb.animateX,
                    y: orb.animateY,
                    scale: orb.animateScale,
                    rotate: orb.animateRotate,
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : {
                    duration: orb.durationSec,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  }
            }
          />
        ))}
      </motion.div>

      {/* 3. Architectural Isometric Sacred Grid & Protractor Reticle */}
      <motion.div
        className="absolute inset-[-4%] opacity-[0.22] will-change-transform"
        style={
          reduceMotion
            ? undefined
            : { x: gridShiftX, y: gridShiftY }
        }
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern
              id="morrowArchitecturalMeshGrid"
              width="72"
              height="72"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 72 0 L 0 0 0 72"
                fill="none"
                stroke={palette.accent}
                strokeOpacity="0.22"
                strokeWidth="0.65"
              />
              <path
                d="M 0 36 L 72 36 M 36 0 L 36 72"
                fill="none"
                stroke={palette.secondary}
                strokeOpacity="0.11"
                strokeWidth="0.45"
                strokeDasharray="2 4"
              />
              <circle
                cx="36"
                cy="36"
                r="1.1"
                fill={palette.accentBright}
                fillOpacity="0.42"
              />
            </pattern>
            <radialGradient id="morrowMeshMask" cx="50%" cy="46%" r="58%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="72%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="morrowGridFadeMask">
              <rect width="100%" height="100%" fill="url(#morrowMeshMask)" />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#morrowArchitecturalMeshGrid)"
            mask="url(#morrowGridFadeMask)"
          />
        </svg>
      </motion.div>

      {/* 4. Diagonal Specular Sweep Beam */}
      {!reduceMotion && intensity !== 'subtle' && (
        <motion.div
          className="absolute -inset-y-1/4 w-[42%] rotate-[18deg] will-change-transform"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${palette.glowRgba} 48%, transparent 100%)`,
            opacity: 0.24,
            filter: 'blur(36px)',
          }}
          animate={{
            x: ['-45vw', '125vw'],
          }}
          transition={{
            duration: 11,
            repeat: Infinity,
            repeatDelay: 4,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
};
