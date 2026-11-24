import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Spatial3DPrefs } from '../../types/agency';
import {
  computeHubOrbTelemetry,
  resolveActiveSpatialPalette,
} from '../../utils/spatial3dConfig';
import {
  createAdaptiveRenderLoop,
  createRoomEnvPMREM,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

interface MorrowHubOrb3DProps {
  spatialPrefs?: Spatial3DPrefs;
  agencyCount?: number;
  activeIndividuals?: number;
  issueCount?: number;
  onPulse?: () => void;
  className?: string;
}

/**
 * Interactive Data-Driven 3D Portfolio Astrolabe inside AgenciesHubView Hero.
 * Reflects live agency count, activity speed, and portfolio health through orbiting crystals and gimbal rings.
 */
export const MorrowHubOrb3D: React.FC<MorrowHubOrb3DProps> = ({
  spatialPrefs,
  agencyCount = 0,
  activeIndividuals = 0,
  issueCount = 0,
  onPulse,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const telemetry = useMemo(
    () => computeHubOrbTelemetry(agencyCount, activeIndividuals, issueCount),
    [agencyCount, activeIndividuals, issueCount]
  );

  const paletteSignature = `${spatialPrefs?.themeId || 'emerald_smoked'}|${spatialPrefs?.customColors?.accent || ''}|${spatialPrefs?.customColors?.secondary || ''}`;

  const liveRef = useRef({
    prefs: spatialPrefs,
    paletteSignature,
    telemetry,
    dragYaw: 0,
    dragPitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    boostUntil: 0,
  });

  liveRef.current.prefs = spatialPrefs;
  liveRef.current.paletteSignature = paletteSignature;
  liveRef.current.telemetry = telemetry;

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
        antialias: true,
        alpha: true,
        powerPreference: probe.isSoftwareGl ? 'low-power' : 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.setPixelRatio(probe.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const w = host.clientWidth || 124;
    const h = host.clientHeight || 124;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.replaceChildren(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    const scene = new THREE.Scene();
    const pmrem = createRoomEnvPMREM(renderer);
    scene.environment = pmrem.envMap;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.set(0, 0, 4.65);

    const keyLight = new THREE.PointLight(0x10b981, 20, 18);
    keyLight.position.set(2.4, 2.8, 3.2);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x22d3ee, 15, 18);
    fillLight.position.set(-2.4, -2.0, 2.8);
    scene.add(fillLight);

    const group = new THREE.Group();
    scene.add(group);

    // 1. Central Faceted Crystal Core + Metallic Equatorial Collar
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.62,
      metalness: 0.78,
      roughness: 0.14,
      flatShading: true,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.86, 0), crystalMat);
    group.add(crystal);

    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x0d1b2a,
      metalness: 0.88,
      roughness: 0.22,
    });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.042, 10, 48), collarMat);
    collar.rotation.x = Math.PI * 0.5;
    group.add(collar);

    // 2. Geodesic Outer Cage
    const cageGeo = new THREE.IcosahedronGeometry(1.26, 0);
    const cageWire = new THREE.WireframeGeometry(cageGeo);
    cageGeo.dispose();
    const cageMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.65,
    });
    const cage = new THREE.LineSegments(cageWire, cageMat);
    group.add(cage);

    // 3. Twin Precision Gimbal Rings
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.65,
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.025, 10, 56), ringMatA);
    ringA.rotation.x = Math.PI * 0.35;
    group.add(ringA);

    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
    });
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.018, 10, 56), ringMatB);
    ringB.rotation.y = Math.PI * 0.4;
    group.add(ringB);

    // 4. Data-driven Orbiting Agency Crystal Satellites (max 8 instanced crystals)
    const maxSats = 8;
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
      metalness: 0.72,
      roughness: 0.18,
      flatShading: true,
    });
    const satMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.11, 0), satMat, maxSats);
    satMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(satMesh);

    const dummy = new THREE.Object3D();

    let lastSig = '';
    const applyPalette = () => {
      if (liveRef.current.paletteSignature === lastSig) return;
      lastSig = liveRef.current.paletteSignature;
      const p = resolveActiveSpatialPalette(liveRef.current.prefs);
      crystalMat.color.setHex(p.nodeColorHex);
      crystalMat.emissive.setHex(p.nodeColorHex);
      cageMat.color.setHex(p.ringColorHex);
      ringMatA.color.setHex(p.coreColorHex);
      ringMatB.color.setHex(p.ringColorHex);
      satMat.color.setHex(p.coreColorHex);
      satMat.emissive.setHex(p.nodeColorHex);
      keyLight.color.setHex(p.nodeColorHex);
      fillLight.color.setHex(p.ringColorHex);
    };
    applyPalette();

    const onDown = (e: PointerEvent) => {
      liveRef.current.dragging = true;
      liveRef.current.lastX = e.clientX;
      liveRef.current.lastY = e.clientY;
    };
    const onUp = () => {
      liveRef.current.dragging = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!liveRef.current.dragging) return;
      const dx = e.clientX - liveRef.current.lastX;
      const dy = e.clientY - liveRef.current.lastY;
      liveRef.current.lastX = e.clientX;
      liveRef.current.lastY = e.clientY;
      liveRef.current.dragYaw += dx * 0.018;
      liveRef.current.dragPitch += dy * 0.014;
    };
    host.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove, { passive: true });

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        applyPalette();
        const cur = liveRef.current;
        if (!cur.dragging) {
          cur.dragYaw = THREE.MathUtils.damp(cur.dragYaw, 0, 1.8, dt);
          cur.dragPitch = THREE.MathUtils.damp(cur.dragPitch, 0, 2.0, dt);
        }
        const boost = performance.now() < cur.boostUntil ? 2.4 : 1;
        const speed = cur.telemetry.ringSpinRate * boost;
        const t = elapsed * speed;

        group.rotation.y = cur.dragYaw + t * 0.72;
        group.rotation.x = cur.dragPitch + Math.sin(t * 0.8) * 0.16;
        cage.rotation.y = -t * 0.55;
        ringA.rotation.z = t * 1.1;
        ringB.rotation.x = -t * 0.85;

        const s = 1 + (boost > 1 ? Math.sin(elapsed * 12) * 0.08 : 0);
        crystal.scale.setScalar(s);

        const activeCount = cur.telemetry.satelliteCount;
        for (let i = 0; i < maxSats; i++) {
          if (i < activeCount) {
            const angle = (i / activeCount) * Math.PI * 2 + t * 0.9;
            const r = 1.62;
            const y = Math.sin(angle * 2 + t) * 0.28;
            dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
            dummy.rotation.set(t * 1.4 + i, t * 0.9, 0);
            dummy.scale.setScalar(1);
          } else {
            dummy.position.set(0, 0, 0);
            dummy.scale.setScalar(0.0001);
          }
          dummy.updateMatrix();
          satMesh.setMatrixAt(i, dummy.matrix);
        }
        satMesh.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
      },
      48
    );
    loop.start();

    return () => {
      loop.stop();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      disposeObject3D(scene);
      pmrem.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  const palette = resolveActiveSpatialPalette(spatialPrefs);

  return (
    <button
      type="button"
      onClick={() => {
        liveRef.current.boostUntil = performance.now() + 900;
        onPulse?.();
      }}
      data-testid="morrow-hub-orb-3d"
      title={`تفاعل مع شعار Morrow ثلاثي الأبعاد · سلامة المحفظة ${telemetry.healthPct}%`}
      aria-label={`تفاعل مع شعار Morrow ثلاثي الأبعاد — ${agencyCount} وكالة، سلامة ${telemetry.healthPct}%`}
      className={`group relative w-[108px] h-[108px] sm:w-[122px] sm:h-[122px] shrink-0 rounded-2xl border border-white/15 recessed-well overflow-hidden cursor-grab active:cursor-grabbing transition hover:scale-[1.03] ${className}`}
      style={{
        boxShadow: `0 14px 32px -12px ${palette.glowRgba}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {!webglFailed ? (
        <div ref={hostRef} className="w-full h-full" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-black text-2xl"
          style={{ color: palette.accentBright }}
        >
          M
        </div>
      )}
      <span
        dir="ltr"
        className="pointer-events-none absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/65 border border-white/10 font-mono-num text-[9px] font-black tracking-tight"
        style={{ color: palette.accentBright }}
      >
        {telemetry.healthPct}%
      </span>
    </button>
  );
};
