import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AppView, Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import { resolveActiveSpatialPalette } from '../../utils/spatial3dConfig';
import { getTabrixViewOrder } from '../../utils/tabrixMotion';
import {
  createAdaptiveRenderLoop,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

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
    scrollNorm: 0,
  });

  liveRef.current.prefs = effectivePrefs;
  liveRef.current.paletteSignature = paletteSignature;
  liveRef.current.activeView = activeView;
  liveRef.current.reduceMotion = reduceMotion;

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      liveRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      liveRef.current.pointerY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      liveRef.current.scrollNorm = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
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
    renderer.toneMappingExposure = 1.08;

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
    camera.position.set(0, 0, 26);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x10b981, 36, 90);
    keyLight.position.set(10, 9, 18);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x22d3ee, 28, 90);
    fillLight.position.set(-12, -8, 16);
    scene.add(fillLight);

    // 1. Geometric Crystal Lattice (InstancedMesh)
    const nodeCount = probe.isSoftwareGl ? 1100 : 2400;
    const nodeGeo = new THREE.OctahedronGeometry(0.072, 0);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
    });
    const latticeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    latticeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const basePositions = new Float32Array(nodeCount * 3);
    const phases = new Float32Array(nodeCount);
    const scales = new Float32Array(nodeCount);
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const primaryColor = new THREE.Color(0x10b981);
    const secondaryColor = new THREE.Color(0x06b6d4);

    for (let i = 0; i < nodeCount; i++) {
      const layer = i % 3;
      const spreadX = 46;
      const spreadY = 28;
      const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * spreadX - spreadX * 0.5;
      const y = ((Math.sin(i * 78.233) * 29432.123) % 1) * spreadY - spreadY * 0.5;
      const z = -4 - layer * 7.5 + ((i * 19) % 10) * 0.45;
      basePositions[i * 3] = Number.isFinite(x) ? x : ((i % 40) - 20) * 1.1;
      basePositions[i * 3 + 1] = Number.isFinite(y) ? y : ((i % 24) - 12) * 1.1;
      basePositions[i * 3 + 2] = z;
      phases[i] = (i * 0.17) % (Math.PI * 2);
      scales[i] = 0.62 + ((i % 7) / 7) * 0.95;

      dummy.position.set(basePositions[i * 3], basePositions[i * 3 + 1], basePositions[i * 3 + 2]);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      latticeMesh.setMatrixAt(i, dummy.matrix);

      tmpColor.lerpColors(primaryColor, secondaryColor, (i % 10) / 10);
      latticeMesh.setColorAt(i, tmpColor);
    }
    latticeMesh.instanceMatrix.needsUpdate = true;
    if (latticeMesh.instanceColor) latticeMesh.instanceColor.needsUpdate = true;
    scene.add(latticeMesh);

    // 2. Architectural Astrolabe Stage: Nested Polyhedron Core + Calibrated Gimbal Rings
    const stageGroup = new THREE.Group();
    stageGroup.position.set(0, 0, -6.5);
    scene.add(stageGroup);

    const ringGeo1 = new THREE.TorusGeometry(10.6, 0.036, 12, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI * 0.36;
    ring1.rotation.y = Math.PI * 0.12;
    stageGroup.add(ring1);

    // Calibrated node markers along primary gimbal ring
    const ringMarkerCount = 16;
    const ringMarkers = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.55 }),
      ringMarkerCount
    );
    for (let i = 0; i < ringMarkerCount; i++) {
      const a = (i / ringMarkerCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 10.6, Math.sin(a) * 10.6, 0);
      dummy.rotation.set(a, a * 0.5, 0);
      dummy.scale.setScalar(i % 4 === 0 ? 1.45 : 0.8);
      dummy.updateMatrix();
      ringMarkers.setMatrixAt(i, dummy.matrix);
    }
    ringMarkers.instanceMatrix.needsUpdate = true;
    ring1.add(ringMarkers);

    const ringGeo2 = new THREE.TorusGeometry(7.6, 0.032, 12, 84);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.24,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI * 0.28;
    ring2.rotation.z = Math.PI * 0.22;
    stageGroup.add(ring2);

    const ringGeo3 = new THREE.TorusGeometry(5.2, 0.022, 10, 72);
    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.2,
    });
    const ring3 = new THREE.Mesh(ringGeo3, ringMat3);
    ring3.rotation.y = Math.PI * 0.34;
    stageGroup.add(ring3);

    // Outer Geodesic Icosahedron Wireframe
    const prismGeo = new THREE.IcosahedronGeometry(4.0, 1);
    const prismWire = new THREE.WireframeGeometry(prismGeo);
    prismGeo.dispose();
    const prismMat = new THREE.LineBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.2,
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
      opacity: 0.16,
    });
    const dodecaLines = new THREE.LineSegments(dodecaWire, dodecaMat);
    stageGroup.add(dodecaLines);

    // Inner Octahedron Wireframe Core
    const innerGeo = new THREE.OctahedronGeometry(1.75, 0);
    const innerWire = new THREE.WireframeGeometry(innerGeo);
    innerGeo.dispose();
    const innerMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.22,
    });
    const innerLines = new THREE.LineSegments(innerWire, innerMat);
    stageGroup.add(innerLines);

    let lastSigApplied = '';
    const applyPalette = (prefs: Spatial3DPrefs, sig: string) => {
      if (sig === lastSigApplied) return;
      lastSigApplied = sig;
      const palette = resolveActiveSpatialPalette(prefs);
      primaryColor.setHex(palette.nodeColorHex);
      secondaryColor.setHex(palette.ringColorHex);
      keyLight.color.setHex(palette.nodeColorHex);
      fillLight.color.setHex(palette.ringColorHex);
      ringMat1.color.setHex(palette.nodeColorHex);
      ringMat2.color.setHex(palette.ringColorHex);
      ringMat3.color.setHex(palette.coreColorHex);
      prismMat.color.setHex(palette.coreColorHex);
      dodecaMat.color.setHex(palette.ringColorHex);
      innerMat.color.setHex(palette.nodeColorHex);
      (ringMarkers.material as THREE.MeshBasicMaterial).color.setHex(palette.coreColorHex);

      for (let i = 0; i < nodeCount; i++) {
        tmpColor.lerpColors(primaryColor, secondaryColor, (i % 12) / 11);
        latticeMesh.setColorAt(i, tmpColor);
      }
      if (latticeMesh.instanceColor) latticeMesh.instanceColor.needsUpdate = true;
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
    let smoothScroll = 0;
    let smoothViewOffset = 0;

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        const current = liveRef.current;
        applyPalette(current.prefs, current.paletteSignature);

        smoothPx = THREE.MathUtils.damp(smoothPx, current.pointerX, 4.4, dt);
        smoothPy = THREE.MathUtils.damp(smoothPy, current.pointerY, 4.4, dt);
        smoothScroll = THREE.MathUtils.damp(smoothScroll, current.scrollNorm, 4.4, dt);
        const targetViewIdx = getTabrixViewOrder(current.activeView) * 0.28;
        smoothViewOffset = THREE.MathUtils.damp(smoothViewOffset, targetViewIdx, 4.4, dt);

        const t = current.reduceMotion ? 0 : elapsed;

        camera.position.x = smoothPx * 1.6;
        camera.position.y = smoothPy * 1.05 - smoothScroll * 2.2;
        camera.position.z = 26 - smoothScroll * 1.8;
        camera.lookAt(0, -smoothScroll * 1.4, -5);

        stageGroup.rotation.y = t * 0.085 + smoothViewOffset * 0.35 + smoothPx * 0.18;
        stageGroup.rotation.x = Math.sin(t * 0.14) * 0.08 + smoothPy * 0.14;
        ring1.rotation.z = t * 0.12;
        ring2.rotation.y = -t * 0.15;
        ring3.rotation.x = t * 0.18;
        prismLines.rotation.x = t * 0.1;
        prismLines.rotation.y = -t * 0.14;
        dodecaLines.rotation.y = t * 0.16;
        dodecaLines.rotation.z = Math.sin(t * 0.12) * 0.22;
        innerLines.rotation.y = -t * 0.24;
        innerLines.rotation.z = t * 0.18;

        if (!current.reduceMotion) {
          const stride = probe.isSoftwareGl ? 3 : 2;
          const phaseOffset = Math.floor(elapsed * 20) % stride;
          for (let i = phaseOffset; i < nodeCount; i += stride) {
            const bx = basePositions[i * 3];
            const by = basePositions[i * 3 + 1];
            const bz = basePositions[i * 3 + 2];
            const ph = phases[i];
            const waveY = Math.sin(t * 0.65 + ph) * 0.26;
            const waveZ = Math.cos(t * 0.45 + ph) * 0.2;
            dummy.position.set(bx, by + waveY, bz + waveZ);
            dummy.rotation.set(t * 0.25 + ph, t * 0.2, 0);
            dummy.scale.setScalar(scales[i]);
            dummy.updateMatrix();
            latticeMesh.setMatrixAt(i, dummy.matrix);
          }
          latticeMesh.instanceMatrix.needsUpdate = true;
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
          className="absolute inset-0 w-full h-full opacity-92"
        />
      ) : null}
    </div>
  );
};
