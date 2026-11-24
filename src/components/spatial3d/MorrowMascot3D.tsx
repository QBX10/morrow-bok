import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import { resolveActiveSpatialPalette } from '../../utils/spatial3dConfig';
import {
  createAdaptiveRenderLoop,
  createRoomEnvPMREM,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

export type MascotMood = 'greet' | 'excited' | 'focus';

interface MorrowMascot3DProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  activeSlideIndex?: number;
  reduceMotion?: boolean;
  onGreetClick?: () => void;
  className?: string;
}

const GREETING_LINES = [
  'أهلاً بك في عالم Morrow! حرّكني أو انقر عليّ للتفاعل',
  'مراو جاهز لمرافقتك في إدارة الوكالات، الحسابات والتدقيق الذكي.',
  'سجّل دخولك بالطريقة التي تفضلها: Google، اسم المستخدم، الهاتف، أو البريد.',
];

const MOOD_LABELS: Array<{ id: MascotMood; label: string }> = [
  { id: 'greet', label: 'ترحيب' },
  { id: 'excited', label: 'حماس' },
  { id: 'focus', label: 'تركيز' },
];

const SLIDE_ORBIT_PROFILES = [
  { ring1TiltX: 0.42, ring1TiltY: 0.12, ring2TiltX: -0.32, satSpeed: 0.72, label: 'استقبال' },
  { ring1TiltX: 0.68, ring1TiltY: -0.42, ring2TiltX: 0.58, satSpeed: 1.28, label: 'تحليل' },
  { ring1TiltX: 0.18, ring1TiltY: 0.54, ring2TiltX: -0.54, satSpeed: 0.96, label: 'حماية' },
] as const;

/**
 * Interactive Cyber-Geometric 3D Smart Cat Companion (Morrow Mascot) built in Three.js.
 * Features chamfered armor collar, rotating Morrow crystal crest, calibrated astrolabe base,
 * twin counter-rotating gimbal rings, slide-adaptive orbital satellites, and responsive moods.
 */
export const MorrowMascot3D: React.FC<MorrowMascot3DProps> = ({
  themeId = 'emerald_smoked',
  spatialPrefs,
  activeSlideIndex = 0,
  reduceMotion = false,
  onGreetClick,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [greetLineIdx, setGreetLineIdx] = useState(0);
  const [mood, setMood] = useState<MascotMood>('greet');

  const effectivePrefs: Spatial3DPrefs = spatialPrefs || {
    themeId,
    tiltIntensity: 'subtle',
    cardDensity: 'balanced',
  };

  const paletteSignature = `${effectivePrefs.themeId}|${effectivePrefs.customColors?.accent || ''}|${effectivePrefs.customColors?.secondary || ''}`;

  const stateRef = useRef({
    prefs: effectivePrefs,
    paletteSignature,
    activeSlideIndex,
    reduceMotion,
    mood,
    pointerX: 0,
    pointerY: 0,
    dragYaw: 0,
    dragPitch: 0,
    dragging: false,
    lastDragX: 0,
    lastDragY: 0,
    waveBoostUntil: 0,
  });

  stateRef.current.prefs = effectivePrefs;
  stateRef.current.paletteSignature = paletteSignature;
  stateRef.current.activeSlideIndex = activeSlideIndex;
  stateRef.current.reduceMotion = reduceMotion;
  stateRef.current.mood = mood;

  const triggerGreeting = () => {
    stateRef.current.waveBoostUntil = performance.now() + 1900;
    setGreetLineIdx((prev) => (prev + 1) % GREETING_LINES.length);
    setMood((prev) => (prev === 'greet' ? 'excited' : prev === 'excited' ? 'focus' : 'greet'));
    onGreetClick?.();
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
    renderer.toneMappingExposure = 1.18;

    const w = host.clientWidth || 320;
    const h = host.clientHeight || 280;
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

    const camera = new THREE.PerspectiveCamera(35, w / Math.max(1, h), 0.1, 40);
    camera.position.set(0, 0.54, 6.45);
    camera.lookAt(0, 0.08, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0b1220, 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
    keyLight.position.set(3.2, 4.6, 4.2);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x10b981, 18, 20);
    rimLight.position.set(-2.9, 2.4, -2.2);
    scene.add(rimLight);

    const frontGlow = new THREE.PointLight(0x22d3ee, 12, 16);
    frontGlow.position.set(2.0, -0.4, 3.2);
    scene.add(frontGlow);

    // Rich PBR Materials with contrasting roughness/metalness
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xeef7f4,
      roughness: 0.28,
      metalness: 0.1,
    });
    const furShadeMat = new THREE.MeshStandardMaterial({
      color: 0xcbe3dc,
      roughness: 0.36,
      metalness: 0.14,
    });
    const titaniumArmorMat = new THREE.MeshStandardMaterial({
      color: 0x0d1b2a,
      roughness: 0.2,
      metalness: 0.84,
    });
    const darkVisorMat = new THREE.MeshStandardMaterial({
      color: 0x060f19,
      roughness: 0.08,
      metalness: 0.65,
    });
    const eyeGlowMat = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      emissive: 0x10b981,
      emissiveIntensity: 1.7,
      roughness: 0.16,
    });
    const innerEarMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.55,
      flatShading: true,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.2,
      metalness: 0.25,
    });
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.35,
      roughness: 0.14,
      metalness: 0.86,
      flatShading: true,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.75,
    });
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.52,
    });
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.55,
    });

    const root = new THREE.Group();
    root.position.set(0, -0.2, 0);
    scene.add(root);

    // 1. Calibrated Astrolabe Base Pedestal + Ground Contact Shadow
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.y = -1.04;
    root.add(pedestalGroup);

    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 48),
      new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = -0.02;
    pedestalGroup.add(shadowDisc);

    const baseRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.032, 12, 72),
      ringMat
    );
    baseRingOuter.rotation.x = Math.PI * 0.5;
    pedestalGroup.add(baseRingOuter);

    const baseRingInner = new THREE.Mesh(
      new THREE.CylinderGeometry(1.16, 1.24, 0.05, 8, 1, true),
      titaniumArmorMat
    );
    baseRingInner.position.y = 0.01;
    pedestalGroup.add(baseRingInner);

    // 24 radial tick markers around astrolabe ring
    const tickCount = 24;
    const tickMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.032, 0.024, 0.11),
      emblemMat,
      tickCount
    );
    const tickDummy = new THREE.Object3D();
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const r = 1.48;
      tickDummy.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
      tickDummy.rotation.set(0, -angle + Math.PI * 0.5, 0);
      tickDummy.scale.set(1, i % 3 === 0 ? 1.55 : 0.9, i % 3 === 0 ? 1.35 : 0.85);
      tickDummy.updateMatrix();
      tickMesh.setMatrixAt(i, tickDummy.matrix);
    }
    tickMesh.instanceMatrix.needsUpdate = true;
    pedestalGroup.add(tickMesh);

    // 2. Twin Counter-Rotating Gyroscopic Rings & Holographic Geometric Satellites
    const orbitRingA = new THREE.Mesh(
      new THREE.TorusGeometry(1.88, 0.024, 12, 72),
      orbitMat
    );
    orbitRingA.position.y = 0.34;
    root.add(orbitRingA);

    const orbitRingB = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.018, 10, 64),
      ringMat
    );
    orbitRingB.position.y = 0.34;
    root.add(orbitRingB);

    const satGroup = new THREE.Group();
    satGroup.position.y = 0.36;
    root.add(satGroup);

    const satPivots: THREE.Group[] = [];
    const satCoords: Array<[number, number, number]> = [
      [1.76, 0.42, 0.34],
      [-1.72, 0.18, 0.36],
      [0.14, 1.46, -0.84],
    ];

    satCoords.forEach(([sx, sy, sz], idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx, sy, sz);

      if (idx === 0) {
        // Faceted Diamond Node + Wireframe Cage
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), emblemMat);
        const cageSrc = new THREE.OctahedronGeometry(0.18, 0);
        const cage = new THREE.LineSegments(new THREE.WireframeGeometry(cageSrc), wireMat);
        cageSrc.dispose();
        pivot.add(core, cage);
      } else if (idx === 1) {
        // Hexagonal Telemetry Prism
        const hex = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.16, 6),
          innerEarMat
        );
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 24), ringMat);
        rim.rotation.x = Math.PI * 0.5;
        pivot.add(hex, rim);
      } else {
        // Geodesic Crown Crystal
        const icosa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), emblemMat);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 24), orbitMat);
        pivot.add(icosa, halo);
      }

      satGroup.add(pivot);
      satPivots.push(pivot);
    });

    // 3. Sculpted Cyber-Geometric Cat Companion Assembly
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 24), furMat);
    torso.scale.set(0.92, 1.05, 0.86);
    torso.position.set(0, -0.22, 0);
    bodyGroup.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.45, 22, 18), furShadeMat);
    belly.scale.set(0.95, 1.02, 0.55);
    belly.position.set(0, -0.28, 0.42);
    bodyGroup.add(belly);

    // Architectural Shoulder Pauldrons for geometric cyber-cat polish
    [-1, 1].forEach((side) => {
      const pauldron = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.16, 6),
        titaniumArmorMat
      );
      pauldron.position.set(side * 0.54, 0.24, 0.08);
      pauldron.rotation.z = -side * 0.52;
      bodyGroup.add(pauldron);
    });

    // Chamfered Octagonal Collar + Accent Trim Ring + Multi-part Morrow Crest
    const collarHex = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.52, 0.14, 8),
      titaniumArmorMat
    );
    collarHex.position.set(0, 0.34, 0.04);
    bodyGroup.add(collarHex);

    const collarTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.025, 10, 40),
      ringMat
    );
    collarTrim.rotation.x = Math.PI * 0.5;
    collarTrim.position.set(0, 0.36, 0.04);
    bodyGroup.add(collarTrim);

    const medallionGroup = new THREE.Group();
    medallionGroup.position.set(0, 0.28, 0.54);
    bodyGroup.add(medallionGroup);
    const medallionCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), emblemMat);
    const medallionFrameSrc = new THREE.OctahedronGeometry(0.175, 0);
    const medallionFrame = new THREE.LineSegments(
      new THREE.WireframeGeometry(medallionFrameSrc),
      wireMat
    );
    medallionFrameSrc.dispose();
    medallionGroup.add(medallionCore, medallionFrame);

    // Sculpted Head Assembly
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.92, 0.06);
    bodyGroup.add(headGroup);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.67, 32, 26), furMat);
    cranium.scale.set(1.13, 0.96, 1.0);
    headGroup.add(cranium);

    // Geometric Cheek/Temple Fins (adds sharp architectural character)
    [-1, 1].forEach((side) => {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.22, 0.28),
        titaniumArmorMat
      );
      fin.position.set(side * 0.69, -0.04, 0.14);
      fin.rotation.z = side * 0.18;
      fin.rotation.y = side * 0.24;
      headGroup.add(fin);
    });

    // Articulated Faceted Geometric Ears
    const makeEar = (side: -1 | 1) => {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.47, 0.49, -0.02);
      earPivot.rotation.z = -side * 0.35;
      earPivot.rotation.x = 0.12;

      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 6), furMat);
      outer.position.y = 0.21;
      earPivot.add(outer);

      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.018, 8, 6),
        titaniumArmorMat
      );
      trim.rotation.x = Math.PI * 0.5;
      trim.position.y = 0.02;
      earPivot.add(trim);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.33, 4), innerEarMat);
      inner.position.set(0, 0.18, 0.08);
      earPivot.add(inner);

      return earPivot;
    };
    const leftEar = makeEar(-1);
    const rightEar = makeEar(1);
    headGroup.add(leftEar, rightEar);

    // Expressive Cyber-Cat Eyes + Mood Brows
    const browMeshes: THREE.Mesh[] = [];
    const makeEye = (side: -1 | 1) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.26, 0.06, 0.59);

      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.145, 0.016, 10, 28),
        titaniumArmorMat
      );
      frame.scale.set(0.98, 1.14, 0.65);
      eyeSocket.add(frame);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.132, 20, 18), darkVisorMat);
      sclera.scale.set(0.94, 1.12, 0.52);
      eyeSocket.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 14), eyeGlowMat);
      iris.scale.set(1, 1.1, 0.4);
      iris.position.set(0, -0.01, 0.056);
      eyeSocket.add(iris);

      const catchlight = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.032, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      catchlight.position.set(side * 0.03, 0.052, 0.082);
      eyeSocket.add(catchlight);

      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.028, 0.04),
        ringMat
      );
      brow.position.set(0, 0.185, 0.04);
      eyeSocket.add(brow);
      browMeshes.push(brow);

      return eyeSocket;
    };
    const leftEye = makeEye(-1);
    const rightEye = makeEye(1);
    headGroup.add(leftEye, rightEye);

    const nose = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), noseMat);
    nose.scale.set(1.2, 0.85, 0.85);
    nose.position.set(0, -0.09, 0.66);
    headGroup.add(nose);

    const whiskerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8);
    [-1, 1].forEach((side) => {
      [-0.08, -0.15].forEach((wy, idx) => {
        const wMesh = new THREE.Mesh(whiskerGeo, ringMat);
        wMesh.position.set(side * 0.45, wy, 0.52);
        wMesh.rotation.z = Math.PI * 0.5 + side * (idx === 0 ? 0.14 : -0.1);
        headGroup.add(wMesh);
      });
    });

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.56, 0.16, 0.12);
    bodyGroup.add(rightArmPivot);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.36, 10, 16), furMat);
    rightArm.position.set(0.12, 0.18, 0.08);
    rightArm.rotation.z = -0.45;
    rightArmPivot.add(rightArm);

    const rightCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.145, 0.06, 8),
      titaniumArmorMat
    );
    rightCuff.position.set(0.2, 0.3, 0.08);
    rightCuff.rotation.z = -0.45;
    rightArmPivot.add(rightCuff);

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.34, 10, 16), furMat);
    leftArm.position.set(-0.56, -0.15, 0.18);
    leftArm.rotation.z = 0.35;
    leftArm.rotation.x = -0.25;
    bodyGroup.add(leftArm);

    [-1, 1].forEach((side) => {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 14), furShadeMat);
      foot.scale.set(1.05, 0.72, 1.32);
      foot.position.set(side * 0.34, -0.84, 0.25);
      bodyGroup.add(foot);
    });

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.68, -0.52);
    bodyGroup.add(tailPivot);

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.28, 0.22, -0.34),
      new THREE.Vector3(0.56, 0.65, -0.28),
      new THREE.Vector3(0.38, 0.96, -0.05),
    ]);
    const tailGeo = new THREE.TubeGeometry(tailCurve, 22, 0.085, 12, false);
    const tailMesh = new THREE.Mesh(tailGeo, furMat);
    const tailTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), emblemMat);
    tailTip.position.set(0.38, 0.96, -0.05);
    tailPivot.add(tailMesh, tailTip);

    let appliedSig = '';
    const syncTheme = (prefs: Spatial3DPrefs, sig: string) => {
      if (sig === appliedSig) return;
      appliedSig = sig;
      const palette = resolveActiveSpatialPalette(prefs);
      rimLight.color.setHex(palette.nodeColorHex);
      frontGlow.color.setHex(palette.ringColorHex);
      eyeGlowMat.color.setHex(palette.coreColorHex);
      eyeGlowMat.emissive.setHex(palette.nodeColorHex);
      innerEarMat.color.setHex(palette.ringColorHex);
      innerEarMat.emissive.setHex(palette.ringColorHex);
      emblemMat.color.setHex(palette.nodeColorHex);
      emblemMat.emissive.setHex(palette.nodeColorHex);
      ringMat.color.setHex(palette.ringColorHex);
      ringMat.emissive.setHex(palette.ringColorHex);
      orbitMat.color.setHex(palette.coreColorHex);
      wireMat.color.setHex(palette.coreColorHex);
    };
    syncTheme(stateRef.current.prefs, stateRef.current.paletteSignature);

    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.dragging = true;
      stateRef.current.lastDragX = e.clientX;
      stateRef.current.lastDragY = e.clientY;
    };
    const onPointerUp = () => {
      stateRef.current.dragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.dragging) {
        const dx = e.clientX - stateRef.current.lastDragX;
        const dy = e.clientY - stateRef.current.lastDragY;
        stateRef.current.lastDragX = e.clientX;
        stateRef.current.lastDragY = e.clientY;
        stateRef.current.dragYaw += dx * 0.012;
        stateRef.current.dragPitch = Math.max(
          -0.45,
          Math.min(0.45, stateRef.current.dragPitch + dy * 0.008)
        );
      }
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      stateRef.current.pointerX = Math.max(-1, Math.min(1, nx));
      stateRef.current.pointerY = Math.max(-1, Math.min(1, ny));
    };

    host.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth || 320;
      const nh = host.clientHeight || 280;
      camera.aspect = nw / Math.max(1, nh);
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    });
    ro.observe(host);

    let smoothPx = 0;
    let smoothPy = 0;
    let prevSlide = stateRef.current.activeSlideIndex;

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        const cur = stateRef.current;
        syncTheme(cur.prefs, cur.paletteSignature);

        if (cur.activeSlideIndex !== prevSlide) {
          prevSlide = cur.activeSlideIndex;
          cur.waveBoostUntil = performance.now() + 1250;
        }

        if (!cur.dragging) {
          cur.dragYaw = THREE.MathUtils.damp(cur.dragYaw, 0, 2.8, dt);
          cur.dragPitch = THREE.MathUtils.damp(cur.dragPitch, 0, 3.2, dt);
        }

        smoothPx = THREE.MathUtils.damp(smoothPx, cur.pointerX, 6.5, dt);
        smoothPy = THREE.MathUtils.damp(smoothPy, cur.pointerY, 6.5, dt);

        const t = cur.reduceMotion ? 0 : elapsed;
        const boostActive = performance.now() < cur.waveBoostUntil || cur.mood === 'excited';
        const isFocus = cur.mood === 'focus';
        const waveSpeed = boostActive ? 11.2 : isFocus ? 2.4 : 4.4;
        const waveAmp = boostActive ? 0.54 : isFocus ? 0.14 : 0.3;

        const slideProfile =
          SLIDE_ORBIT_PROFILES[cur.activeSlideIndex % SLIDE_ORBIT_PROFILES.length] ||
          SLIDE_ORBIT_PROFILES[0];

        const bounce = boostActive ? Math.abs(Math.sin(t * 8.4)) * 0.14 : 0;
        bodyGroup.position.y = Math.sin(t * 2.1) * 0.055 + bounce;
        bodyGroup.rotation.y = cur.dragYaw + smoothPx * 0.24 + Math.sin(t * 0.9) * 0.08;
        bodyGroup.rotation.x = cur.dragPitch;

        headGroup.rotation.y = smoothPx * 0.36;
        headGroup.rotation.x =
          -smoothPy * 0.22 + Math.sin(t * 1.6) * 0.04 + (isFocus ? 0.08 : 0);
        headGroup.rotation.z = -smoothPx * 0.08 + (isFocus ? 0.08 : 0);

        leftEar.rotation.z = 0.35 + Math.sin(t * 3.2) * (boostActive ? 0.14 : 0.03);
        rightEar.rotation.z = -0.35 - Math.sin(t * 3.2 + 0.6) * (boostActive ? 0.14 : 0.03);

        const blinkCycle = elapsed % 3.8;
        const isBlinking = !cur.reduceMotion && blinkCycle > 3.62 && blinkCycle < 3.76;
        const eyeScaleY = isBlinking ? 0.12 : cur.mood === 'excited' ? 1.14 : isFocus ? 0.88 : 1;
        leftEye.scale.y = eyeScaleY;
        rightEye.scale.y = eyeScaleY;

        // Expressive brow tilts per mood
        const browTilt = isFocus ? 0.22 : cur.mood === 'excited' ? -0.14 : -0.04;
        if (browMeshes[0]) browMeshes[0].rotation.z = -browTilt;
        if (browMeshes[1]) browMeshes[1].rotation.z = browTilt;

        rightArmPivot.rotation.z = Math.sin(t * waveSpeed) * waveAmp + 0.2;
        rightArmPivot.rotation.x = Math.cos(t * waveSpeed * 0.5) * 0.12 - 0.18;

        tailPivot.rotation.y = Math.sin(t * (boostActive ? 5.2 : 3.4)) * 0.4;
        medallionGroup.rotation.y = t * 1.6;
        medallionGroup.rotation.x = Math.sin(t * 2.2) * 0.16;

        // Slide-reactive twin gimbal orbits & calibrated pedestal
        orbitRingA.rotation.x = THREE.MathUtils.damp(
          orbitRingA.rotation.x,
          Math.PI * slideProfile.ring1TiltX,
          4.2,
          dt
        );
        orbitRingA.rotation.y = THREE.MathUtils.damp(
          orbitRingA.rotation.y,
          Math.PI * slideProfile.ring1TiltY,
          4.2,
          dt
        );
        orbitRingA.rotation.z = t * 0.52 * slideProfile.satSpeed;

        orbitRingB.rotation.x = THREE.MathUtils.damp(
          orbitRingB.rotation.x,
          Math.PI * slideProfile.ring2TiltX,
          4.2,
          dt
        );
        orbitRingB.rotation.y = t * 0.42;
        orbitRingB.rotation.z = -t * 0.64 * slideProfile.satSpeed;

        pedestalGroup.rotation.y = -t * 0.28;
        satGroup.rotation.y = t * 0.58 * slideProfile.satSpeed;
        for (let i = 0; i < satPivots.length; i++) {
          satPivots[i].rotation.y = t * (1.1 + i * 0.25);
          satPivots[i].rotation.x = Math.sin(t * 1.4 + i) * 0.35;
        }

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
      window.removeEventListener('pointermove', onPointerMove);
      disposeObject3D(scene);
      pmrem.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  const palette = resolveActiveSpatialPalette(effectivePrefs);
  const activeStageLabel =
    SLIDE_ORBIT_PROFILES[activeSlideIndex % SLIDE_ORBIT_PROFILES.length]?.label ||
    'استقبال';

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="relative w-full h-[265px] sm:h-[305px] rounded-[26px] overflow-hidden border border-white/15 bg-[var(--bg-surface)]/55 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${palette.glowRgba}, transparent 68%)`,
          }}
        />

        {!webglFailed ? (
          <div
            ref={hostRef}
            data-testid="morrow-mascot-3d"
            className="w-full h-full relative z-10 cursor-grab active:cursor-grabbing"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative z-10">
            <div className="w-28 h-28 rounded-full border-2 border-[var(--accent)] flex items-center justify-center text-4xl font-black text-[var(--accent-bright)]">
              M
            </div>
          </div>
        )}

        {/* Mood Selector */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl bg-black/55 border border-white/10 p-1 backdrop-blur-md">
          {MOOD_LABELS.map((item) => {
            const active = mood === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMood(item.id);
                  stateRef.current.waveBoostUntil = performance.now() + 1200;
                }}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Orbital Profile Tag */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 px-2.5 py-1 rounded-xl bg-black/45 border border-white/10 text-[10px] font-extrabold text-[var(--accent-bright)]">
          وضع: {activeStageLabel}
        </div>

        <button
          type="button"
          onClick={triggerGreeting}
          data-testid="morrow-mascot-greet-btn"
          aria-label="تحية مساعد Morrow الذكي ثلاثي الأبعاد"
          className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-[11px] font-bold text-[var(--accent-bright)] backdrop-blur-md transition cursor-pointer"
        >
          تفاعل مع مراو ✨
        </button>
      </div>

      <div className="mt-3 w-full rounded-2xl px-4 py-2.5 border border-[var(--border-color)] bg-black/35 backdrop-blur-md text-center">
        <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-relaxed">
          {GREETING_LINES[greetLineIdx]}
        </p>
      </div>
    </div>
  );
};
