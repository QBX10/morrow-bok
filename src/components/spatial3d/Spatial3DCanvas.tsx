import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AppView, Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import {
  computeParticleDisplacement,
  createFloatingParticleFieldSpec,
  getSpatialViewChoreography,
  resolveActiveSpatialPalette,
} from '../../utils/spatial3dConfig';
import {
  createAdaptiveRenderLoop,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

function createParticleGlowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.54, 'rgba(255, 255, 255, 0.24)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface Spatial3DCanvasProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  activeView?: AppView;
  reduceMotion?: boolean;
  className?: string;
}

export const Spatial3DCanvas: React.FC<Spatial3DCanvasProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  activeView = 'hub',
  reduceMotion = false,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const effectivePrefs: Spatial3DPrefs = spatialPrefs || {
    themeId,
    tiltIntensity: 'subtle',
    cardDensity: 'balanced',
  };

  const paletteSignature = `${effectivePrefs.themeId}|${effectivePrefs.customColors?.accent || ''}|${effectivePrefs.customColors?.secondary || ''}|${effectivePrefs.customColors?.surfaceTone || ''}`;

  const liveRef = useRef({
    prefs: effectivePrefs,
    paletteSignature,
    activeView,
    reduceMotion,
    pointerX: 0,
    pointerY: 0,
    pointerSpeed: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    scrollNorm: 0,
    pulseStartedAt: 0,
    pulseIntensity: 1,
  });

  liveRef.current.prefs = effectivePrefs;
  liveRef.current.paletteSignature = paletteSignature;
  liveRef.current.activeView = activeView;
  liveRef.current.reduceMotion = reduceMotion;

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      const dx = nx - liveRef.current.lastPointerX;
      const dy = ny - liveRef.current.lastPointerY;
      const instantSpeed = Math.min(2.8, Math.hypot(dx, dy) * 22);
      liveRef.current.pointerSpeed = Math.max(liveRef.current.pointerSpeed, instantSpeed);
      liveRef.current.lastPointerX = nx;
      liveRef.current.lastPointerY = ny;
      liveRef.current.pointerX = nx;
      liveRef.current.pointerY = ny;
    };
    const onScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      liveRef.current.scrollNorm = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };
    const onSpatialPulse = (e: Event) => {
      const custom = e as CustomEvent<{ intensity?: number; timestamp?: number }>;
      liveRef.current.pulseStartedAt = custom.detail?.timestamp || performance.now();
      liveRef.current.pulseIntensity = Math.max(
        0.4,
        Math.min(2, custom.detail?.intensity ?? 1)
      );
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('morrow:spatial-pulse', onSpatialPulse as EventListener);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('morrow:spatial-pulse', onSpatialPulse as EventListener);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const probe = detectSoftwareWebGL();
    if (!probe.supported) {
      setWebglFailed(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !probe.isSoftwareGl,
        alpha: true,
        powerPreference: probe.isSoftwareGl ? 'low-power' : 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.setPixelRatio(probe.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const width = host.clientWidth || window.innerWidth || 1280;
    const height = host.clientHeight || window.innerHeight || 720;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-hidden', 'true');

    host.replaceChildren(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / Math.max(1, height), 0.1, 140);
    camera.position.set(0, 0, 25.5);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x10e0a6, 38, 95);
    keyLight.position.set(10, 9, 18);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x22d3ee, 30, 95);
    fillLight.position.set(-12, -8, 16);
    scene.add(fillLight);

    // 1. Geometric Crystal Lattice (InstancedMesh)
    const nodeCount = probe.isSoftwareGl ? 960 : 2100;
    const nodeGeo = new THREE.OctahedronGeometry(0.068, 0);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.54,
    });
    const latticeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    latticeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const basePositions = new Float32Array(nodeCount * 3);
    const phases = new Float32Array(nodeCount);
    const scales = new Float32Array(nodeCount);
    const radialDist = new Float32Array(nodeCount);
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const primaryColor = new THREE.Color(0x10e0a6);
    const secondaryColor = new THREE.Color(0x22d3ee);
    const coreColor = new THREE.Color(0x86ffde);

    for (let i = 0; i < nodeCount; i++) {
      const layer = i % 3;
      const spreadX = 46;
      const spreadY = 28;
      const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * spreadX - spreadX * 0.5;
      const y = ((Math.sin(i * 78.233) * 29432.123) % 1) * spreadY - spreadY * 0.5;
      const z = -4 - layer * 7.5 + ((i * 19) % 10) * 0.45;
      const fx = Number.isFinite(x) ? x : ((i % 40) - 20) * 1.1;
      const fy = Number.isFinite(y) ? y : ((i % 24) - 12) * 1.1;
      basePositions[i * 3] = fx;
      basePositions[i * 3 + 1] = fy;
      basePositions[i * 3 + 2] = z;
      phases[i] = (i * 0.17) % (Math.PI * 2);
      scales[i] = 0.62 + ((i % 7) / 7) * 0.95;
      radialDist[i] = Math.hypot(fx, fy);

      dummy.position.set(fx, fy, z);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      latticeMesh.setMatrixAt(i, dummy.matrix);

      tmpColor.lerpColors(primaryColor, secondaryColor, (i % 10) / 10);
      latticeMesh.setColorAt(i, tmpColor);
    }
    latticeMesh.instanceMatrix.needsUpdate = true;
    if (latticeMesh.instanceColor) latticeMesh.instanceColor.needsUpdate = true;
    scene.add(latticeMesh);

    // 1B. Mouse-Reactive Floating Luminous Particle Field (THREE.Points)
    const particleSpec = createFloatingParticleFieldSpec(probe.isSoftwareGl);
    const particlePositions = new Float32Array(particleSpec.basePositions);
    const particleColors = new Float32Array(particleSpec.count * 3);
    const particleBaseColors = new Float32Array(particleSpec.count * 3);
    const particleGeo = new THREE.BufferGeometry();
    const particlePosAttr = new THREE.BufferAttribute(particlePositions, 3);
    particlePosAttr.setUsage(THREE.DynamicDrawUsage);
    const particleColAttr = new THREE.BufferAttribute(particleColors, 3);
    particleColAttr.setUsage(THREE.DynamicDrawUsage);
    particleGeo.setAttribute('position', particlePosAttr);
    particleGeo.setAttribute('color', particleColAttr);

    const glowTexture = createParticleGlowTexture();
    const particleMat = new THREE.PointsMaterial({
      size: probe.isSoftwareGl ? 0.44 : 0.48,
      map: glowTexture || undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const floatingParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(floatingParticles);

    // 2. Architectural Astrolabe Stage: View-Choreographed Polyhedron Core + Calibrated Gimbal Rings
    const stageGroup = new THREE.Group();
    stageGroup.position.set(0, 0, -6.5);
    scene.add(stageGroup);

    const ringGeo1 = new THREE.TorusGeometry(10.8, 0.036, 12, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x10e0a6,
      transparent: true,
      opacity: 0.19,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI * 0.36;
    ring1.rotation.y = Math.PI * 0.16;
    stageGroup.add(ring1);

    // Calibrated node markers along primary gimbal ring
    const ringMarkerCount = 16;
    const ringMarkers = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0x86ffde, transparent: true, opacity: 0.52 }),
      ringMarkerCount
    );
    for (let i = 0; i < ringMarkerCount; i++) {
      const a = (i / ringMarkerCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 10.8, Math.sin(a) * 10.8, 0);
      dummy.rotation.set(a, a * 0.5, 0);
      dummy.scale.setScalar(i % 4 === 0 ? 1.45 : 0.8);
      dummy.updateMatrix();
      ringMarkers.setMatrixAt(i, dummy.matrix);
    }
    ringMarkers.instanceMatrix.needsUpdate = true;
    ring1.add(ringMarkers);

    const ringGeo2 = new THREE.TorusGeometry(7.7, 0.03, 12, 84);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.16,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI * 0.3;
    ring2.rotation.z = Math.PI * 0.24;
    stageGroup.add(ring2);

    const ringGeo3 = new THREE.TorusGeometry(5.2, 0.02, 10, 72);
    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0x86ffde,
      transparent: true,
      opacity: 0.15,
    });
    const ring3 = new THREE.Mesh(ringGeo3, ringMat3);
    ring3.rotation.x = Math.PI * 0.28;
    ring3.rotation.y = Math.PI * 0.32;
    stageGroup.add(ring3);

    // Outer Geodesic Icosahedron Wireframe
    const prismGeo = new THREE.IcosahedronGeometry(4.0, 1);
    const prismWire = new THREE.WireframeGeometry(prismGeo);
    prismGeo.dispose();
    const prismMat = new THREE.LineBasicMaterial({
      color: 0x86ffde,
      transparent: true,
      opacity: 0.21,
    });
    const prismLines = new THREE.LineSegments(prismWire, prismMat);
    stageGroup.add(prismLines);

    // Mid Dodecahedral Wireframe Cage
    const dodecaGeo = new THREE.DodecahedronGeometry(2.85, 0);
    const dodecaWire = new THREE.WireframeGeometry(dodecaGeo);
    dodecaGeo.dispose();
    const dodecaMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.17,
    });
    const dodecaLines = new THREE.LineSegments(dodecaWire, dodecaMat);
    stageGroup.add(dodecaLines);

    // Inner Octahedron Wireframe Core
    const innerGeo = new THREE.OctahedronGeometry(1.75, 0);
    const innerWire = new THREE.WireframeGeometry(innerGeo);
    innerGeo.dispose();
    const innerMat = new THREE.LineBasicMaterial({
      color: 0x10e0a6,
      transparent: true,
      opacity: 0.24,
    });
    const innerLines = new THREE.LineSegments(innerWire, innerMat);
    stageGroup.add(innerLines);

    // Global Expanding Energy Wave Ring on Interactive UI Pulses
    const pulseWaveMat = new THREE.MeshBasicMaterial({
      color: 0x86ffde,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const pulseWave = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.018, 8, 72), pulseWaveMat);
    pulseWave.rotation.x = Math.PI * 0.36;
    pulseWave.rotation.y = Math.PI * 0.14;
    stageGroup.add(pulseWave);

    let lastSigApplied = '';
    const applyPalette = (prefs: Spatial3DPrefs, sig: string) => {
      if (sig === lastSigApplied) return;
      lastSigApplied = sig;
      const palette = resolveActiveSpatialPalette(prefs);
      primaryColor.setHex(palette.nodeColorHex);
      secondaryColor.setHex(palette.ringColorHex);
      coreColor.setHex(palette.coreColorHex);
      keyLight.color.setHex(palette.nodeColorHex);
      fillLight.color.setHex(palette.ringColorHex);
      ringMat1.color.setHex(palette.nodeColorHex);
      ringMat2.color.setHex(palette.ringColorHex);
      ringMat3.color.setHex(palette.coreColorHex);
      prismMat.color.setHex(palette.coreColorHex);
      dodecaMat.color.setHex(palette.ringColorHex);
      innerMat.color.setHex(palette.nodeColorHex);
      pulseWaveMat.color.setHex(palette.coreColorHex);
      (ringMarkers.material as THREE.MeshBasicMaterial).color.setHex(palette.coreColorHex);

      for (let i = 0; i < nodeCount; i++) {
        tmpColor.lerpColors(primaryColor, secondaryColor, (i % 12) / 11);
        latticeMesh.setColorAt(i, tmpColor);
      }
      if (latticeMesh.instanceColor) latticeMesh.instanceColor.needsUpdate = true;

      for (let i = 0; i < particleSpec.count; i++) {
        const mix = particleSpec.colorMix[i];
        tmpColor.lerpColors(primaryColor, secondaryColor, mix);
        if (i % 5 === 0) {
          tmpColor.lerp(coreColor, 0.55);
        }
        const idx3 = i * 3;
        particleBaseColors[idx3] = tmpColor.r;
        particleBaseColors[idx3 + 1] = tmpColor.g;
        particleBaseColors[idx3 + 2] = tmpColor.b;
        particleColors[idx3] = tmpColor.r;
        particleColors[idx3 + 1] = tmpColor.g;
        particleColors[idx3 + 2] = tmpColor.b;
      }
      particleColAttr.needsUpdate = true;
    };

    applyPalette(liveRef.current.prefs, liveRef.current.paletteSignature);

    const handleResize = () => {
      if (!host) return;
      const w = host.clientWidth || window.innerWidth || 1280;
      const h = host.clientHeight || window.innerHeight || 720;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(host);

    let smoothPx = 0;
    let smoothPy = 0;
    let smoothPSpeed = 0;
    let smoothScroll = 0;
    let smoothCamZ = 25.5;
    let smoothCamY = 0;
    let smoothStageYaw = 0;
    let smoothStagePitch = 0;
    let smoothStageScale = 1;
    let smoothRingSpeed = 1;

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        const current = liveRef.current;
        applyPalette(current.prefs, current.paletteSignature);

        const viewChoreo = getSpatialViewChoreography(current.activeView);

        smoothPx = THREE.MathUtils.damp(smoothPx, current.pointerX, 4.4, dt);
        smoothPy = THREE.MathUtils.damp(smoothPy, current.pointerY, 4.4, dt);
        smoothPSpeed = THREE.MathUtils.damp(smoothPSpeed, current.pointerSpeed, 6.0, dt);
        current.pointerSpeed = Math.max(0, current.pointerSpeed - dt * 2.8);
        smoothScroll = THREE.MathUtils.damp(smoothScroll, current.scrollNorm, 4.4, dt);
        smoothCamZ = THREE.MathUtils.damp(smoothCamZ, viewChoreo.cameraZ, 3.2, dt);
        smoothCamY = THREE.MathUtils.damp(smoothCamY, viewChoreo.cameraYOffset, 3.2, dt);
        smoothStageYaw = THREE.MathUtils.damp(smoothStageYaw, viewChoreo.stageYaw, 3.2, dt);
        smoothStagePitch = THREE.MathUtils.damp(smoothStagePitch, viewChoreo.stagePitch, 3.2, dt);
        smoothStageScale = THREE.MathUtils.damp(smoothStageScale, viewChoreo.stageScale, 3.2, dt);
        smoothRingSpeed = THREE.MathUtils.damp(smoothRingSpeed, viewChoreo.ringSpeedMult, 3.2, dt);

        const t = current.reduceMotion ? 0 : elapsed;

        // Interactive Pulse Propagation
        const pulseElapsed = performance.now() - current.pulseStartedAt;
        const pulseWindow = 1400;
        const hasPulse =
          !current.reduceMotion &&
          current.pulseStartedAt > 0 &&
          pulseElapsed >= 0 &&
          pulseElapsed < pulseWindow;
        const pulseProg = hasPulse ? pulseElapsed / pulseWindow : 0;

        if (hasPulse) {
          pulseWave.scale.setScalar(1 + pulseProg * 2.2 * current.pulseIntensity);
          pulseWaveMat.opacity = (1 - pulseProg) * 0.28;
        } else {
          pulseWaveMat.opacity = 0;
        }

        camera.position.x = smoothPx * 1.65;
        camera.position.y = smoothPy * 1.1 + smoothCamY - smoothScroll * 2.2;
        camera.position.z = smoothCamZ - smoothScroll * 1.8;
        camera.lookAt(0, smoothCamY * 0.4 - smoothScroll * 1.4, -5);

        stageGroup.scale.setScalar(smoothStageScale);
        stageGroup.rotation.y =
          t * 0.085 * smoothRingSpeed + smoothStageYaw + smoothPx * 0.18;
        stageGroup.rotation.x =
          Math.sin(t * 0.14) * 0.08 + smoothStagePitch + smoothPy * 0.14;
        ring1.rotation.z = t * 0.12 * smoothRingSpeed;
        ring2.rotation.y = -t * 0.15 * smoothRingSpeed;
        ring3.rotation.x = t * 0.18 * smoothRingSpeed;
        prismLines.rotation.x = t * 0.1;
        prismLines.rotation.y = -t * 0.14;
        dodecaLines.rotation.y = t * 0.16;
        dodecaLines.rotation.z = Math.sin(t * 0.12) * 0.22;
        innerLines.rotation.y = -t * 0.24 * smoothRingSpeed;
        innerLines.rotation.z = t * 0.18;

        if (!current.reduceMotion) {
          const stride = probe.isSoftwareGl ? 3 : 2;
          const phaseOffset = Math.floor(elapsed * 20) % stride;
          const waveFrontRadius = pulseProg * 28;
          for (let i = phaseOffset; i < nodeCount; i += stride) {
            const bx = basePositions[i * 3];
            const by = basePositions[i * 3 + 1];
            const bz = basePositions[i * 3 + 2];
            const ph = phases[i];
            const waveY = Math.sin(t * 0.65 + ph) * 0.26;
            const waveZ = Math.cos(t * 0.45 + ph) * 0.2;

            let rippleScale = 1;
            let rippleZ = 0;
            if (hasPulse) {
              const distDelta = Math.abs(radialDist[i] - waveFrontRadius);
              if (distDelta < 4.5) {
                const ripple = (1 - distDelta / 4.5) * (1 - pulseProg) * current.pulseIntensity;
                rippleScale += ripple * 0.85;
                rippleZ += ripple * 1.25;
              }
            }

            dummy.position.set(bx, by + waveY, bz + waveZ + rippleZ);
            dummy.rotation.set(t * 0.25 + ph, t * 0.2, 0);
            dummy.scale.setScalar(scales[i] * rippleScale);
            dummy.updateMatrix();
            latticeMesh.setMatrixAt(i, dummy.matrix);
          }
          latticeMesh.instanceMatrix.needsUpdate = true;

          // Update mouse-reactive floating luminous particles (zero per-frame allocations)
          const pCount = particleSpec.count;
          const pBase = particleSpec.basePositions;
          const pPhases = particleSpec.phases;
          const pSpeeds = particleSpec.speeds;
          const pDepth = particleSpec.depthLayers;

          for (let i = 0; i < pCount; i++) {
            const idx3 = i * 3;
            const disp = computeParticleDisplacement({
              baseX: pBase[idx3],
              baseY: pBase[idx3 + 1],
              baseZ: pBase[idx3 + 2],
              phase: pPhases[i],
              speed: pSpeeds[i],
              depthWeight: pDepth[i],
              timeSec: t,
              pointerX: smoothPx,
              pointerY: smoothPy,
              pointerSpeed: smoothPSpeed,
              pulseActive: hasPulse,
              pulseProgress: pulseProg,
              pulseIntensity: current.pulseIntensity,
            });
            particlePositions[idx3] = disp.x;
            particlePositions[idx3 + 1] = disp.y;
            particlePositions[idx3 + 2] = disp.z;

            // Shimmer & highlight particles near pointer halo or pulse wave
            const shimmer =
              0.78 +
              0.22 * Math.sin(t * (1.2 + pSpeeds[i]) + pPhases[i]) +
              disp.glowBoost * 0.55;
            const br = particleBaseColors[idx3];
            const bg = particleBaseColors[idx3 + 1];
            const bb = particleBaseColors[idx3 + 2];
            particleColors[idx3] = Math.min(1, br * shimmer + disp.glowBoost * coreColor.r * 0.4);
            particleColors[idx3 + 1] = Math.min(1, bg * shimmer + disp.glowBoost * coreColor.g * 0.4);
            particleColors[idx3 + 2] = Math.min(1, bb * shimmer + disp.glowBoost * coreColor.b * 0.4);
          }
          particlePosAttr.needsUpdate = true;
          particleColAttr.needsUpdate = true;
        }

        renderer.render(scene, camera);
      },
      60
    );

    loop.start();

    return () => {
      loop.stop();
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      glowTexture?.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  const palette = resolveActiveSpatialPalette(effectivePrefs);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: `radial-gradient(960px circle at 82% 8%, ${palette.glowRgba}, transparent 62%), radial-gradient(760px circle at 14% 92%, ${palette.secondaryGlowRgba}, transparent 60%)`,
        }}
      />
      {!webglFailed ? (
        <div
          ref={hostRef}
          data-testid="spatial-3d-canvas"
          className="absolute inset-0 w-full h-full opacity-95"
        />
      ) : null}
    </div>
  );
};
