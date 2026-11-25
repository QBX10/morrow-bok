import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Spatial3DPrefs, Spatial3DThemeId } from '../../types/agency';
import {
  type MorrowEntityMood,
  resolveActiveSpatialPalette,
  resolveMorrowEntityMoodState,
  triggerGlobalSpatialPulse,
} from '../../utils/spatial3dConfig';
import {
  createAdaptiveRenderLoop,
  createRoomEnvPMREM,
  detectSoftwareWebGL,
  disposeObject3D,
} from './webglUtils';

export type MascotMood = MorrowEntityMood;

interface MorrowMascot3DProps {
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
  activeSlideIndex?: number;
  reduceMotion?: boolean;
  onGreetClick?: () => void;
  className?: string;
}

const GREETING_LINES = [
  'أهلاً بك في عالم Morrow! حرّكني أو انقر عليّ لتجربة النبض الذكي',
  'Morrow جاهز لمرافقتك في إدارة الوكالات، الحسابات والتدقيق الفوري.',
  'سجّل دخولك بالطريقة التي تفضلها: Google، اسم المستخدم، الهاتف، أو البريد.',
];

const MOOD_LABELS: Array<{ id: MascotMood; label: string }> = [
  { id: 'greet', label: 'ترحيب' },
  { id: 'excited', label: 'حماس' },
  { id: 'focus', label: 'تركيز' },
];

const SLIDE_ORBIT_PROFILES = [
  { ring1TiltX: 0.42, ring1TiltY: 0.14, ring2TiltX: -0.34, satSpeed: 0.78, label: 'استقبال' },
  { ring1TiltX: 0.66, ring1TiltY: -0.44, ring2TiltX: 0.54, satSpeed: 1.32, label: 'تحليل' },
  { ring1TiltX: 0.22, ring1TiltY: 0.56, ring2TiltX: -0.52, satSpeed: 1.02, label: 'حماية' },
] as const;

/**
 * Interactive 3D "Morrow Neural Sovereign" AI Entity built in Three.js.
 * Features an aerodynamic titanium-obsidian cranial visor with pointer-tracking optical eye-arcs,
 * 4 articulated floating aero-stabilizer wings, dual-crystal chest reactor, calibrated astrolabe pedestal,
 * holographic projection beam, shockwave pulse ring, and synchronized 2D-3D global pulse dispatch.
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
    dragMoved: false,
    lastDragX: 0,
    lastDragY: 0,
    waveBoostUntil: 0,
    pulseStartedAt: 0,
  });

  stateRef.current.prefs = effectivePrefs;
  stateRef.current.paletteSignature = paletteSignature;
  stateRef.current.activeSlideIndex = activeSlideIndex;
  stateRef.current.reduceMotion = reduceMotion;
  stateRef.current.mood = mood;

  const triggerGreeting = () => {
    const now = performance.now();
    stateRef.current.waveBoostUntil = now + 1850;
    stateRef.current.pulseStartedAt = now;
    setGreetLineIdx((prev) => (prev + 1) % GREETING_LINES.length);
    triggerGlobalSpatialPulse(1.4);
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
    renderer.toneMappingExposure = 1.24;

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

    const camera = new THREE.PerspectiveCamera(34, w / Math.max(1, h), 0.1, 40);
    camera.position.set(0, 0.44, 7.15);
    camera.lookAt(0, 0.04, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x060b18, 1.05);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3.4, 4.8, 4.4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x10e0a6, 22, 22);
    rimLight.position.set(-3.0, 2.6, -2.0);
    scene.add(rimLight);

    const frontGlow = new THREE.PointLight(0x22d3ee, 15, 18);
    frontGlow.position.set(2.2, -0.2, 3.4);
    scene.add(frontGlow);

    // Rich Sleek Tech Materials
    const pearlShellMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.22,
      metalness: 0.42,
    });
    const obsidianArmorMat = new THREE.MeshStandardMaterial({
      color: 0x0a1324,
      roughness: 0.18,
      metalness: 0.88,
    });
    const darkVisorMat = new THREE.MeshStandardMaterial({
      color: 0x030812,
      roughness: 0.06,
      metalness: 0.78,
    });
    const eyeGlowMat = new THREE.MeshStandardMaterial({
      color: 0x86ffde,
      emissive: 0x10e0a6,
      emissiveIntensity: 1.9,
      roughness: 0.12,
    });
    const energyCoreMat = new THREE.MeshStandardMaterial({
      color: 0x10e0a6,
      emissive: 0x10e0a6,
      emissiveIntensity: 1.5,
      roughness: 0.14,
      metalness: 0.82,
      flatShading: true,
    });
    const secondaryGlowMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.76,
    });
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0x86ffde,
      transparent: true,
      opacity: 0.58,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x10e0a6,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.65,
    });

    const root = new THREE.Group();
    root.position.set(0, -0.2, 0);
    scene.add(root);

    // 1. Calibrated Astrolabe Pedestal + Holographic Projection Cone
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.y = -1.16;
    root.add(pedestalGroup);

    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.32, 48),
      new THREE.MeshBasicMaterial({
        color: 0x020612,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = -0.02;
    pedestalGroup.add(shadowDisc);

    const baseRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.03, 12, 72),
      secondaryGlowMat
    );
    baseRingOuter.rotation.x = Math.PI * 0.5;
    pedestalGroup.add(baseRingOuter);

    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.24, 0.07, 12, 1, false),
      obsidianArmorMat
    );
    basePlinth.position.y = 0.015;
    pedestalGroup.add(basePlinth);

    const baseInnerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.02, 10, 56),
      energyCoreMat
    );
    baseInnerRing.rotation.x = Math.PI * 0.5;
    baseInnerRing.position.y = 0.055;
    pedestalGroup.add(baseInnerRing);

    const hologramBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.96, 1.5, 32, 1, true),
      beamMat
    );
    hologramBeam.position.y = 0.78;
    pedestalGroup.add(hologramBeam);

    // Shockwave Ring on Click/Pulse
    const shockwaveRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.032, 10, 64),
      shockwaveMat
    );
    shockwaveRing.rotation.x = Math.PI * 0.5;
    shockwaveRing.position.y = 0.1;
    pedestalGroup.add(shockwaveRing);

    // 24 Radial Telemetry Ticks
    const tickCount = 24;
    const tickMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.03, 0.022, 0.11),
      energyCoreMat,
      tickCount
    );
    const tickDummy = new THREE.Object3D();
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const r = 1.48;
      tickDummy.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
      tickDummy.rotation.set(0, -angle + Math.PI * 0.5, 0);
      tickDummy.scale.set(1, i % 4 === 0 ? 1.65 : 0.9, i % 4 === 0 ? 1.4 : 0.85);
      tickDummy.updateMatrix();
      tickMesh.setMatrixAt(i, tickDummy.matrix);
    }
    tickMesh.instanceMatrix.needsUpdate = true;
    pedestalGroup.add(tickMesh);

    // 2. Triple Gyroscopic Rings & Orbital Geometric Satellites
    const orbitRingA = new THREE.Mesh(
      new THREE.TorusGeometry(1.92, 0.022, 12, 72),
      orbitMat
    );
    orbitRingA.position.y = 0.34;
    root.add(orbitRingA);

    const orbitRingB = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.017, 10, 64),
      secondaryGlowMat
    );
    orbitRingB.position.y = 0.34;
    root.add(orbitRingB);

    const meridianRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.44, 0.012, 8, 64),
      orbitMat
    );
    meridianRing.position.y = 0.34;
    meridianRing.rotation.y = Math.PI * 0.5;
    root.add(meridianRing);

    const satGroup = new THREE.Group();
    satGroup.position.y = 0.34;
    root.add(satGroup);

    const satPivots: THREE.Group[] = [];
    const satCoords: Array<[number, number, number]> = [
      [1.82, 0.44, 0.32],
      [-1.78, 0.16, 0.36],
      [0.18, 1.52, -0.78],
      [-0.22, -0.72, 1.38],
    ];

    satCoords.forEach(([sx, sy, sz], idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx, sy, sz);

      if (idx === 0) {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), energyCoreMat);
        const cageSrc = new THREE.OctahedronGeometry(0.17, 0);
        const cage = new THREE.LineSegments(new THREE.WireframeGeometry(cageSrc), wireMat);
        cageSrc.dispose();
        pivot.add(core, cage);
      } else if (idx === 1) {
        const hex = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.15, 6),
          secondaryGlowMat
        );
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 8, 24), orbitMat);
        rim.rotation.x = Math.PI * 0.5;
        pivot.add(hex, rim);
      } else if (idx === 2) {
        const icosa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), energyCoreMat);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 24), orbitMat);
        pivot.add(icosa, halo);
      } else {
        const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), eyeGlowMat);
        pivot.add(diamond);
      }

      satGroup.add(pivot);
      satPivots.push(pivot);
    });

    // 3. Sentient Morrow Sovereign Entity Assembly (Floating Aero-Chassis + Visor + 4 Wings)
    const entityGroup = new THREE.Group();
    root.add(entityGroup);

    // Lower Stabilizer Tail Fin (Hover Engine Thruster Core)
    const lowerCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.08, 0.44, 8),
      obsidianArmorMat
    );
    lowerCore.position.set(0, -0.58, 0);
    entityGroup.add(lowerCore);

    const thrusterGlow = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.24, 12),
      eyeGlowMat
    );
    thrusterGlow.rotation.x = Math.PI;
    thrusterGlow.position.set(0, -0.84, 0);
    entityGroup.add(thrusterGlow);

    // Sculpted Chamfered Torso Hull
    const chestHull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.34, 0.72, 8),
      obsidianArmorMat
    );
    chestHull.position.set(0, -0.05, 0);
    entityGroup.add(chestHull);

    // Sleek Titanium-Pearl Chest Armor Plate
    const chestCarapace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.4, 0.34, 8, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      pearlShellMat
    );
    chestCarapace.position.set(0, 0.08, 0.06);
    entityGroup.add(chestCarapace);

    // Chamfered Luminous Collar Ring
    const collarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.024, 10, 40),
      secondaryGlowMat
    );
    collarRing.rotation.x = Math.PI * 0.5;
    collarRing.position.set(0, 0.34, 0.02);
    entityGroup.add(collarRing);

    // Suspended Dual-Crystal Chest Reactor Core
    const reactorGroup = new THREE.Group();
    reactorGroup.position.set(0, 0.05, 0.49);
    entityGroup.add(reactorGroup);

    const reactorCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), energyCoreMat);
    const reactorCageSrc = new THREE.IcosahedronGeometry(0.21, 0);
    const reactorCage = new THREE.LineSegments(
      new THREE.WireframeGeometry(reactorCageSrc),
      wireMat
    );
    reactorCageSrc.dispose();
    const reactorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.016, 10, 32),
      secondaryGlowMat
    );
    reactorGroup.add(reactorCrystal, reactorCage, reactorRing);

    // 4 Articulated Floating Aero-Stabilizer Wings (Left/Right Upper + Lower)
    interface WingAssembly {
      pivot: THREE.Group;
      side: -1 | 1;
      tier: 'upper' | 'lower';
      baseZ: number;
      baseY: number;
    }
    const wings: WingAssembly[] = [];

    ([-1, 1] as const).forEach((side) => {
      (['upper', 'lower'] as const).forEach((tier) => {
        const pivot = new THREE.Group();
        const isUpper = tier === 'upper';
        const baseY = isUpper ? 0.32 : -0.08;
        const baseZ = isUpper ? -0.14 : -0.18;
        pivot.position.set(side * 0.62, baseY, baseZ);

        const bladeLength = isUpper ? 0.88 : 0.64;
        const bladeHeight = isUpper ? 0.22 : 0.16;

        const mainBlade = new THREE.Mesh(
          new THREE.BoxGeometry(bladeLength, bladeHeight, 0.06),
          obsidianArmorMat
        );
        mainBlade.position.set(side * (bladeLength * 0.48), isUpper ? 0.1 : -0.05, 0);
        mainBlade.rotation.z = side * (isUpper ? 0.38 : -0.26);
        mainBlade.rotation.y = -side * 0.28;
        pivot.add(mainBlade);

        // Luminous Aero Leading-Edge Trim
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(bladeLength * 0.92, 0.028, 0.075),
          isUpper ? eyeGlowMat : secondaryGlowMat
        );
        trim.position.set(
          side * (bladeLength * 0.48),
          (isUpper ? 0.1 : -0.05) + bladeHeight * 0.44,
          0.01
        );
        trim.rotation.z = mainBlade.rotation.z;
        trim.rotation.y = mainBlade.rotation.y;
        pivot.add(trim);

        // Wing Shoulder Hinge Pod
        const hinge = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.085, 0),
          pearlShellMat
        );
        pivot.add(hinge);

        entityGroup.add(pivot);
        wings.push({ pivot, side, tier, baseZ, baseY });
      });
    });

    // 4. Aerodynamic Sentient Cranial Visor Helmet + Pointer-Tracking Eyes
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.88, 0.05);
    entityGroup.add(headGroup);

    // Smooth Titanium-Pearl Cranium Shell
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 24), pearlShellMat);
    cranium.scale.set(1.12, 0.92, 1.04);
    headGroup.add(cranium);

    // Sculpted Obsidian Crown Crest Spine
    const crownCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.16, 0.72),
      obsidianArmorMat
    );
    crownCrest.position.set(0, 0.5, -0.04);
    crownCrest.rotation.x = 0.08;
    headGroup.add(crownCrest);

    const crownStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.04, 0.62),
      eyeGlowMat
    );
    crownStrip.position.set(0, 0.57, -0.02);
    crownStrip.rotation.x = 0.08;
    headGroup.add(crownStrip);

    // Lateral Acoustic Sensor Pods (Sleek circular/octagonal tech pods, zero ears)
    ([-1, 1] as const).forEach((side) => {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.14, 8),
        obsidianArmorMat
      );
      pod.rotation.z = Math.PI * 0.5;
      pod.position.set(side * 0.64, -0.02, 0.02);
      headGroup.add(pod);

      const podHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.018, 8, 24),
        secondaryGlowMat
      );
      podHalo.rotation.y = Math.PI * 0.5;
      podHalo.position.set(side * 0.72, -0.02, 0.02);
      headGroup.add(podHalo);
    });

    // Curved Obsidian-Sapphire Glass Visor Faceplate
    const visorFrame = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 22, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.22, Math.PI * 0.56),
      obsidianArmorMat
    );
    visorFrame.rotation.y = Math.PI * 0.5;
    visorFrame.scale.set(1.06, 0.94, 1.12);
    visorFrame.position.set(0, -0.02, 0.06);
    headGroup.add(visorFrame);

    const visorGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.545, 32, 22, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.26, Math.PI * 0.48),
      darkVisorMat
    );
    visorGlass.rotation.y = Math.PI * 0.5;
    visorGlass.scale.set(1.06, 0.92, 1.11);
    visorGlass.position.set(0, -0.02, 0.085);
    headGroup.add(visorGlass);

    // Pointer-Tracking Expressive Optical Eye-Arcs + Neural Telemetry Bar
    const opticalGroup = new THREE.Group();
    opticalGroup.position.set(0, 0.01, 0.67);
    headGroup.add(opticalGroup);

    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.2, 0.03, 0);
    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.2, 0.03, 0);
    opticalGroup.add(leftEyeGroup, rightEyeGroup);

    const buildEyeBar = (target: THREE.Group, side: -1 | 1) => {
      const eyeBar = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052, 0.12, 8, 16),
        eyeGlowMat
      );
      eyeBar.rotation.z = side * 0.16;
      eyeBar.scale.set(1, 0.88, 0.55);
      target.add(eyeBar);

      const catchlight = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.024, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      catchlight.position.set(side * 0.028, 0.035, 0.042);
      target.add(catchlight);
    };
    buildEyeBar(leftEyeGroup, -1);
    buildEyeBar(rightEyeGroup, 1);

    // Center Neural Equalizer Voice/Pulse Bar inside Visor
    const neuralBars: THREE.Mesh[] = [];
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.075, 0.02),
        secondaryGlowMat
      );
      bar.position.set(i * 0.042, -0.15, -0.02);
      opticalGroup.add(bar);
      neuralBars.push(bar);
    }

    let appliedSig = '';
    const syncTheme = (prefs: Spatial3DPrefs, sig: string) => {
      if (sig === appliedSig) return;
      appliedSig = sig;
      const palette = resolveActiveSpatialPalette(prefs);
      rimLight.color.setHex(palette.nodeColorHex);
      frontGlow.color.setHex(palette.ringColorHex);
      eyeGlowMat.color.setHex(palette.coreColorHex);
      eyeGlowMat.emissive.setHex(palette.nodeColorHex);
      energyCoreMat.color.setHex(palette.nodeColorHex);
      energyCoreMat.emissive.setHex(palette.nodeColorHex);
      secondaryGlowMat.color.setHex(palette.ringColorHex);
      secondaryGlowMat.emissive.setHex(palette.ringColorHex);
      orbitMat.color.setHex(palette.coreColorHex);
      beamMat.color.setHex(palette.nodeColorHex);
      shockwaveMat.color.setHex(palette.ringColorHex);
      wireMat.color.setHex(palette.coreColorHex);
    };
    syncTheme(stateRef.current.prefs, stateRef.current.paletteSignature);

    const onPointerDown = (e: PointerEvent) => {
      stateRef.current.dragging = true;
      stateRef.current.dragMoved = false;
      stateRef.current.lastDragX = e.clientX;
      stateRef.current.lastDragY = e.clientY;
    };
    const onPointerUp = () => {
      if (stateRef.current.dragging && !stateRef.current.dragMoved) {
        const now = performance.now();
        stateRef.current.waveBoostUntil = now + 1500;
        stateRef.current.pulseStartedAt = now;
        triggerGlobalSpatialPulse(1.25);
      }
      stateRef.current.dragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.dragging) {
        const dx = e.clientX - stateRef.current.lastDragX;
        const dy = e.clientY - stateRef.current.lastDragY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          stateRef.current.dragMoved = true;
        }
        stateRef.current.lastDragX = e.clientX;
        stateRef.current.lastDragY = e.clientY;
        stateRef.current.dragYaw += dx * 0.013;
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
    let smoothWingFlare = 0.12;
    let smoothEyeScale = 1;
    let prevSlide = stateRef.current.activeSlideIndex;

    const loop = createAdaptiveRenderLoop(
      renderer,
      probe.isSoftwareGl,
      (elapsed, dt) => {
        const cur = stateRef.current;
        syncTheme(cur.prefs, cur.paletteSignature);

        const now = performance.now();
        if (cur.activeSlideIndex !== prevSlide) {
          prevSlide = cur.activeSlideIndex;
          cur.waveBoostUntil = now + 1300;
          cur.pulseStartedAt = now;
        }

        if (!cur.dragging) {
          cur.dragYaw = THREE.MathUtils.damp(cur.dragYaw, 0, 2.6, dt);
          cur.dragPitch = THREE.MathUtils.damp(cur.dragPitch, 0, 3.0, dt);
        }

        smoothPx = THREE.MathUtils.damp(smoothPx, cur.pointerX, 6.8, dt);
        smoothPy = THREE.MathUtils.damp(smoothPy, cur.pointerY, 6.8, dt);

        const pulseActive = now < cur.waveBoostUntil;
        const moodState = resolveMorrowEntityMoodState(
          cur.mood,
          cur.activeSlideIndex,
          pulseActive
        );

        const t = cur.reduceMotion ? 0 : elapsed;
        const slideProfile =
          SLIDE_ORBIT_PROFILES[cur.activeSlideIndex % SLIDE_ORBIT_PROFILES.length] ||
          SLIDE_ORBIT_PROFILES[0];

        // Hover & Energetic Impulse Lift
        const hoverLift =
          Math.sin(t * 2.3) * moodState.hoverAmplitude +
          (pulseActive ? Math.abs(Math.sin(t * 7.5)) * 0.1 : 0);
        entityGroup.position.y = hoverLift;
        entityGroup.rotation.y = cur.dragYaw + smoothPx * 0.26 + Math.sin(t * 0.85) * 0.08;
        entityGroup.rotation.x = cur.dragPitch;

        // Cranial Visor Tracking
        headGroup.rotation.y = smoothPx * 0.42;
        headGroup.rotation.x =
          -smoothPy * 0.24 + Math.sin(t * 1.4) * 0.035 + moodState.visorTiltRad;
        headGroup.rotation.z = -smoothPx * 0.09;

        // Eye-Arcs Tracking + Organic Blinking
        opticalGroup.position.x = smoothPx * 0.06;
        opticalGroup.position.y = smoothPy * 0.04;
        const blinkCycle = elapsed % 4.1;
        const isBlinking = !cur.reduceMotion && blinkCycle > 3.92 && blinkCycle < 4.05;
        const targetEyeScaleY = isBlinking ? 0.08 : moodState.eyeScaleY;
        smoothEyeScale = THREE.MathUtils.damp(smoothEyeScale, targetEyeScaleY, 16, dt);
        leftEyeGroup.scale.y = smoothEyeScale;
        rightEyeGroup.scale.y = smoothEyeScale;

        eyeGlowMat.emissiveIntensity = moodState.emissiveBoost;
        energyCoreMat.emissiveIntensity = moodState.emissiveBoost * 0.92;

        // Neural Voice / Activity Waveform inside Visor
        for (let i = 0; i < neuralBars.length; i++) {
          const wave = cur.reduceMotion
            ? 1
            : 0.55 + Math.abs(Math.sin(t * (pulseActive ? 10 : 4.2) + i * 0.9)) * 0.95;
          neuralBars[i].scale.y = wave;
        }

        // Chest Reactor Spin
        reactorGroup.rotation.y = t * moodState.coreSpinSpeed;
        reactorGroup.rotation.x = Math.sin(t * 1.9) * 0.22;
        reactorRing.rotation.z = -t * moodState.coreSpinSpeed * 1.25;

        // Articulated 4 Aero-Stabilizer Wings
        smoothWingFlare = THREE.MathUtils.damp(smoothWingFlare, moodState.wingFlareRad, 5.5, dt);
        for (let i = 0; i < wings.length; i++) {
          const wObj = wings[i];
          const phase = wObj.tier === 'upper' ? 0 : 1.1;
          const flutter = cur.reduceMotion
            ? 0
            : Math.sin(t * (pulseActive ? 7.5 : 2.6) + phase) * (pulseActive ? 0.14 : 0.055);
          wObj.pivot.rotation.z = wObj.side * (smoothWingFlare + flutter);
          wObj.pivot.rotation.y = -wObj.side * (cur.mood === 'focus' ? 0.28 : 0.06);
          wObj.pivot.position.y = wObj.baseY + Math.sin(t * 2.3 + phase) * 0.035;
        }

        // Expanding Holographic Shockwave Ring
        const shockElapsed = now - cur.pulseStartedAt;
        if (cur.pulseStartedAt > 0 && shockElapsed >= 0 && shockElapsed < 1100) {
          const prog = shockElapsed / 1100;
          shockwaveRing.scale.setScalar(1 + prog * 1.9);
          shockwaveMat.opacity = (1 - prog) * 0.85;
        } else {
          shockwaveMat.opacity = 0;
        }

        // Holographic Beam Subtle Shimmer
        beamMat.opacity = 0.07 + (pulseActive ? 0.08 : Math.sin(t * 2.2) * 0.02);

        // Slide-Reactive Triple Gyro Orbits & Pedestal
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
        orbitRingA.rotation.z = t * moodState.haloSpeed * slideProfile.satSpeed;

        orbitRingB.rotation.x = THREE.MathUtils.damp(
          orbitRingB.rotation.x,
          Math.PI * slideProfile.ring2TiltX,
          4.2,
          dt
        );
        orbitRingB.rotation.y = t * 0.45;
        orbitRingB.rotation.z = -t * moodState.haloSpeed * 1.1 * slideProfile.satSpeed;

        meridianRing.rotation.x = t * 0.38;
        meridianRing.rotation.z = Math.sin(t * 0.7) * 0.25;

        pedestalGroup.rotation.y = -t * 0.28;
        satGroup.rotation.y = t * 0.62 * slideProfile.satSpeed;
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
      <div
        className="relative w-full h-[275px] sm:h-[315px] rounded-[26px] overflow-hidden border border-white/15 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.9)]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 15%, rgba(15, 30, 56, 0.72) 0%, rgba(4, 8, 20, 0.92) 72%)',
        }}
      >
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

        {/* Mood Selector (translucent solid obsidian fill, no backdrop-blur over WebGL) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl bg-[#050C1A]/88 border border-white/15 p-1">
          {MOOD_LABELS.map((item) => {
            const active = mood === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`morrow-mood-${item.id}`}
                onClick={() => {
                  const now = performance.now();
                  setMood(item.id);
                  stateRef.current.waveBoostUntil = now + 1250;
                  stateRef.current.pulseStartedAt = now;
                  triggerGlobalSpatialPulse(1.1);
                }}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer"
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
        <div className="pointer-events-none absolute top-3 left-3 z-20 px-2.5 py-1 rounded-xl bg-[#050C1A]/85 border border-white/15 text-[10px] font-extrabold text-[var(--accent-bright)]">
          وضع: {activeStageLabel}
        </div>

        <button
          type="button"
          onClick={triggerGreeting}
          data-testid="morrow-mascot-greet-btn"
          aria-label="تفاعل مع نظام Morrow الذكي ثلاثي الأبعاد"
          className="absolute bottom-3 left-3 z-20 px-3.5 py-1.5 rounded-xl bg-[#061224]/90 hover:bg-[#0B1E3B] border border-[var(--accent)]/40 text-[11px] font-extrabold text-[var(--accent-bright)] shadow-[0_6px_20px_-6px_var(--spatial-glow)] transition cursor-pointer"
        >
          تفاعل مع Morrow ✨
        </button>
      </div>

      <div className="mt-3 w-full rounded-2xl px-4 py-2.5 border border-[var(--border-color)] bg-[#060E1F]/80 text-center">
        <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-relaxed">
          {GREETING_LINES[greetLineIdx]}
        </p>
      </div>
    </div>
  );
};

export const MorrowEntity3D = MorrowMascot3D;
