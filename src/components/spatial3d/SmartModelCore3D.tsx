import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createAdaptiveRenderLoop,
  createRoomEnvPMREM,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

export type SmartCoreExecutionState = 'idle' | 'thinking' | 'streaming' | 'complete';

interface SmartModelCore3DProps {
  accentHex: string;
  secondaryHex: string;
  executionState: SmartCoreExecutionState;
  modelTitle: string;
  selectedModelId?: string;
  reduceMotion?: boolean;
  onPulseClick?: () => void;
  className?: string;
}

const MODEL_AXIS_MAP: Record<string, { rx: number; ry: number; ringTilt: number }> = {
  audit_inspector: { rx: 0.42, ry: 0.28, ringTilt: 0.35 },
  quota_forecaster: { rx: -0.35, ry: 0.56, ringTilt: 0.52 },
  finance_optimizer: { rx: 0.55, ry: -0.4, ringTilt: 0.24 },
  ledger_synthesizer: { rx: -0.22, ry: -0.5, ringTilt: 0.65 },
};

/**
 * Interactive Multi-Tier 3D Holographic Core & Calibrated Orbital Matrix.
 * Supports drag-to-orbit, model-adaptive axis shifts, shockwave pulse, and live execution state feedback.
 */
export const SmartModelCore3D: React.FC<SmartModelCore3DProps> = ({
  accentHex,
  secondaryHex,
  executionState,
  modelTitle,
  selectedModelId = 'audit_inspector',
  reduceMotion = false,
  onPulseClick,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const liveRef = useRef({
    accentHex,
    secondaryHex,
    executionState,
    selectedModelId,
    reduceMotion,
    pointerX: 0,
    pointerY: 0,
    dragYaw: 0,
    dragPitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pulseUntil: 0,
  });

  liveRef.current.accentHex = accentHex;
  liveRef.current.secondaryHex = secondaryHex;
  liveRef.current.executionState = executionState;
  liveRef.current.selectedModelId = selectedModelId;
  liveRef.current.reduceMotion = reduceMotion;

  const triggerCorePulse = () => {
    liveRef.current.pulseUntil = performance.now() + 950;
    onPulseClick?.();
  };

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

    const w = host.clientWidth || 320;
    const h = host.clientHeight || 240;
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

    const camera = new THREE.PerspectiveCamera(40, w / Math.max(1, h), 0.1, 40);
    camera.position.set(0, 0, 5.55);

    const keyLight = new THREE.PointLight(0x10b981, 24, 22);
    keyLight.position.set(2.8, 3.2, 4.0);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x22d3ee, 18, 22);
    fillLight.position.set(-3.0, -2.5, 3.5);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);

    // 1. Multi-Part Core Crystal + Metallic Equatorial Gimbal Collar
    const coreGroup = new THREE.Group();
    root.add(coreGroup);

    const innerGeo = new THREE.IcosahedronGeometry(0.84, 1);
    const innerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentHex),
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.72,
      metalness: 0.78,
      roughness: 0.15,
      flatShading: true,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerCore);

    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0x0b1622,
      metalness: 0.88,
      roughness: 0.2,
    });
    const caliper = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.042, 10, 48), caliperMat);
    caliper.rotation.x = Math.PI * 0.5;
    coreGroup.add(caliper);

    // 2. Outer Geodesic Dodecahedron Cage
    const outerSrc = new THREE.DodecahedronGeometry(1.32, 0);
    const outerWire = new THREE.WireframeGeometry(outerSrc);
    outerSrc.dispose();
    const outerMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(secondaryHex),
      transparent: true,
      opacity: 0.68,
    });
    const outerShell = new THREE.LineSegments(outerWire, outerMat);
    root.add(outerShell);

    // 3. Precision Gimbal Ring Matrix
    const ringMatA = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accentHex),
      transparent: true,
      opacity: 0.62,
    });
    const ringMatB = new THREE.MeshBasicMaterial({
      color: new THREE.Color(secondaryHex),
      transparent: true,
      opacity: 0.52,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.025, 12, 72), ringMatA);
    ring1.rotation.x = Math.PI * 0.35;
    root.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.021, 12, 72), ringMatB);
    ring2.rotation.y = Math.PI * 0.42;
    root.add(ring2);

    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.016, 10, 72), ringMatA);
    ring3.rotation.x = -Math.PI * 0.25;
    ring3.rotation.y = Math.PI * 0.25;
    root.add(ring3);

    // Interactive pulse shockwave ring
    const pulseMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(secondaryHex),
      transparent: true,
      opacity: 0,
    });
    const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.036, 10, 64), pulseMat);
    root.add(pulseRing);

    // 4. Instanced Orbital Data Nodes
    const count = probe.isSoftwareGl ? 64 : 112;
    const nodeGeo = new THREE.OctahedronGeometry(0.044, 0);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(secondaryHex),
      transparent: true,
      opacity: 0.88,
    });
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, count);
    nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(nodes);

    const dummy = new THREE.Object3D();
    const targetAccent = new THREE.Color(accentHex);
    const targetSecondary = new THREE.Color(secondaryHex);

    const onPointerDown = (e: PointerEvent) => {
      liveRef.current.dragging = true;
      liveRef.current.lastX = e.clientX;
      liveRef.current.lastY = e.clientY;
    };
    const onPointerUp = () => {
      liveRef.current.dragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (liveRef.current.dragging) {
        const dx = e.clientX - liveRef.current.lastX;
        const dy = e.clientY - liveRef.current.lastY;
        liveRef.current.lastX = e.clientX;
        liveRef.current.lastY = e.clientY;
        liveRef.current.dragYaw += dx * 0.014;
        liveRef.current.dragPitch = Math.max(
          -0.8,
          Math.min(0.8, liveRef.current.dragPitch + dy * 0.012)
        );
      }
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      liveRef.current.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      liveRef.current.pointerY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    host.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('pointermove', onPointerMove, { passive: true });

    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth || 320;
      const nh = host.clientHeight || 240;
      camera.aspect = nw / Math.max(1, nh);
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    });
    ro.observe(host);

    let smoothPx = 0;
    let smoothPy = 0;

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        const cur = liveRef.current;
        targetAccent.set(cur.accentHex);
        targetSecondary.set(cur.secondaryHex);

        innerMat.color.lerp(targetAccent, 0.14);
        innerMat.emissive.lerp(targetAccent, 0.14);
        outerMat.color.lerp(targetSecondary, 0.14);
        ringMatA.color.lerp(targetAccent, 0.14);
        ringMatB.color.lerp(targetSecondary, 0.14);
        nodeMat.color.lerp(targetSecondary, 0.14);
        pulseMat.color.lerp(targetSecondary, 0.18);
        keyLight.color.lerp(targetAccent, 0.14);
        fillLight.color.lerp(targetSecondary, 0.14);

        if (!cur.dragging) {
          cur.dragYaw = THREE.MathUtils.damp(cur.dragYaw, 0, 2.0, dt);
          cur.dragPitch = THREE.MathUtils.damp(cur.dragPitch, 0, 2.4, dt);
        }

        smoothPx = THREE.MathUtils.damp(smoothPx, cur.pointerX, 6.2, dt);
        smoothPy = THREE.MathUtils.damp(smoothPy, cur.pointerY, 6.2, dt);

        const now = performance.now();
        const pulseRemaining = Math.max(0, cur.pulseUntil - now);
        const pulseProg = pulseRemaining > 0 ? 1 - pulseRemaining / 950 : 0;

        if (pulseRemaining > 0) {
          pulseRing.scale.setScalar(1 + pulseProg * 1.48);
          pulseMat.opacity = (1 - pulseProg) * 0.8;
        } else {
          pulseMat.opacity = 0;
        }

        const speedMult =
          cur.executionState === 'thinking'
            ? 2.8
            : cur.executionState === 'streaming'
            ? 2.1
            : cur.executionState === 'complete'
            ? 1.25
            : 0.78;

        const t = cur.reduceMotion ? 0 : elapsed * speedMult;
        const pulse =
          (cur.executionState === 'thinking'
            ? 1 + Math.sin(elapsed * 8) * 0.08
            : cur.executionState === 'complete'
            ? 1.04
            : 1 + Math.sin(elapsed * 2.2) * 0.03) +
          (pulseRemaining > 0 ? Math.sin(pulseProg * Math.PI) * 0.14 : 0);

        innerMat.emissiveIntensity =
          cur.executionState === 'thinking'
            ? 1.18
            : cur.executionState === 'complete'
            ? 0.92
            : 0.65 + (pulseRemaining > 0 ? 0.55 : 0);

        const modelAxis = MODEL_AXIS_MAP[cur.selectedModelId] || MODEL_AXIS_MAP.audit_inspector;

        root.rotation.y = cur.dragYaw + smoothPx * 0.35 + t * 0.25 + modelAxis.ry * 0.45;
        root.rotation.x = cur.dragPitch - smoothPy * 0.25 + modelAxis.rx * 0.35;

        coreGroup.scale.setScalar(pulse);
        innerCore.rotation.y = t * 0.72;
        innerCore.rotation.x = t * 0.45;
        caliper.rotation.y = -t * 0.9;
        outerShell.rotation.y = -t * 0.5;
        outerShell.rotation.z = t * 0.3;

        ring1.rotation.x = THREE.MathUtils.damp(ring1.rotation.x, Math.PI * modelAxis.ringTilt, 3.8, dt);
        ring1.rotation.z = t * 0.85;
        ring2.rotation.x = t * 0.65;
        ring3.rotation.z = -t * 0.52;

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + t * 0.35;
          const elevation = Math.sin(i * 0.45 + t * 1.1) * 0.95;
          const radius = 1.98 + Math.cos(i * 0.3 + t * 1.4) * 0.24;
          dummy.position.set(
            Math.cos(angle) * radius,
            elevation,
            Math.sin(angle) * radius
          );
          dummy.rotation.set(t + i, t * 0.7, 0);
          const s = cur.executionState === 'thinking' ? 1.35 : 0.92;
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          nodes.setMatrixAt(i, dummy.matrix);
        }
        nodes.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
      },
      54
    );

    loop.start();

    return () => {
      loop.stop();
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('pointermove', onPointerMove);
      disposeObject3D(scene);
      pmrem.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  return (
    <div
      className={`relative rounded-[22px] overflow-hidden border border-white/10 recessed-well ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 45%, ${accentHex}28, rgba(4, 10, 18, 0.92) 72%)`,
      }}
    >
      {!webglFailed ? (
        <div
          ref={hostRef}
          data-testid="smart-model-core-3d"
          aria-label={`النواة التفاعلية — ${modelTitle}`}
          className="w-full h-[215px] sm:h-[245px] cursor-grab active:cursor-grabbing"
        />
      ) : (
        <div className="w-full h-[215px] sm:h-[245px] flex items-center justify-center">
          <div
            className="w-24 h-24 rounded-full border-2 flex items-center justify-center font-black text-lg"
            style={{ borderColor: accentHex, color: accentHex }}
          >
            Morrow
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/55 border border-white/10 backdrop-blur-md text-[11px] font-bold text-[var(--text-primary)]">
        {executionState === 'thinking'
          ? 'جاري التحليل...'
          : executionState === 'complete'
          ? 'اكتمل التحليل'
          : 'تفاعلي · اسحب للتدوير'}
      </div>

      <button
        type="button"
        onClick={triggerCorePulse}
        className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 border border-white/15 text-[10px] font-bold backdrop-blur-md cursor-pointer transition"
        style={{ color: accentHex }}
      >
        نبضة 3D ✨
      </button>
    </div>
  );
};
