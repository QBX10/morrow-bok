import React, { useEffect, useRef, useState } from 'react';

export interface LampShaderPhysicsState {
  cordSwayNorm: number; // -1..1 normalized pendulum sway angle
  cordPullNorm: number; // 0..1 normalized downward stretch
  headAngleDeg: number; // live lamp head swivel angle in degrees
}

interface LampRaymarchShaderProps {
  isOn: boolean;
  isFocused: boolean;
  pullProgress: number;
  reducedMotion: boolean;
  apertureRef: React.RefObject<HTMLSpanElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  physicsRef: React.MutableRefObject<LampShaderPhysicsState>;
}

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_lampPos;
  uniform vec2 u_beamDir;
  uniform vec4 u_cardRect;
  uniform float u_cardVisible;
  uniform float u_lightIntensity;
  uniform float u_lightReach;
  uniform float u_cordAngle;
  uniform float u_cordPull;
  uniform float u_reducedMotion;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * valueNoise(p);
      p = p * 2.03 + vec2(17.1, 31.7);
      amp *= 0.5;
    }
    return v;
  }

  vec2 rotate2D(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / max(u_resolution.xy, vec2(1.0));
    float aspectX = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 aspect = vec2(aspectX, 1.0);

    vec2 pa = uv * aspect;
    vec2 la = u_lampPos * aspect;

    // Subtle dynamic deflection of beam direction coupled to physical cord sway angle
    vec2 beamDir = normalize(rotate2D(u_beamDir, u_cordAngle * 0.13));

    vec2 toPix = pa - la;
    float dist = length(toPix);
    vec2 rayDir = toPix / max(dist, 0.0002);

    // Light reach radius expands progressively from the bulb across the darkened glass stage
    float maxReach = mix(0.08, 1.88, u_lightReach);
    float reachEnvelope = smoothstep(maxReach, max(0.0, maxReach - 0.34), dist);
    float preWarmReach = smoothstep(0.44, 0.02, dist) * (u_cordPull * 0.42);

    // Directional parabolic reflector cone (blocks stray backward leaks behind shade dome)
    float dirCos = dot(rayDir, beamDir);
    float wideCone = smoothstep(0.06, 0.72, dirCos);
    float coreCone = smoothstep(0.64, 0.96, dirCos);

    // Subtle internal optical reflector Tyndall streaks that shift subtly as cord sways
    float rayAngle = atan(rayDir.y, rayDir.x);
    float causticRibs = 0.88 + 0.12 * sin(rayAngle * 16.0 - u_cordAngle * 1.4);

    // Aperture halo right at bulb filament
    float bulbCore = exp(-dist * 18.0) * smoothstep(-0.32, 0.45, dirCos);
    float apertureScatter = exp(-dist * 4.9) * (0.34 + 0.66 * wideCone);

    // Login glass panel SDF in aspect-corrected space
    vec2 cardCenter = u_cardRect.xy * aspect;
    vec2 cardHalf = max(u_cardRect.zw * aspect, vec2(0.001));
    float cardSdf = sdRoundBox(pa - cardCenter, cardHalf, 0.024);

    // Dynamic shadow density modulated by live pull-cord swing angle
    float cordTiltMod = clamp(abs(u_cordAngle) * 0.62 + u_cordAngle * 0.22, -0.16, 0.68);
    float shadowDensity = clamp(0.66 + cordTiltMod * 0.34, 0.48, 0.98);

    // Volumetric raymarching loop marching from lamp mouth to pixel for scattering + cast shadow
    const int MARCH_STEPS = 24;
    float accumScatter = 0.0;
    float transmittance = 1.0;

    float motionTime = u_reducedMotion > 0.5 ? 0.0 : u_time;

    for (int i = 1; i <= MARCH_STEPS; i++) {
      float t = float(i) / float(MARCH_STEPS);
      vec2 samplePos = mix(la, pa, t);
      float sampleDist = length(samplePos - la);

      // Progressive march wavefront cutoff
      float stepReach = smoothstep(maxReach, max(0.0, maxReach - 0.26), sampleDist);

      // Occlusion from glass panel when marching behind the panel relative to lamp
      if (u_cardVisible > 0.04) {
        float sCard = sdRoundBox(samplePos - cardCenter, cardHalf * vec2(0.96, 0.95), 0.022);
        if (sCard < 0.0 && cardSdf > 0.002 && t < 0.94) {
          float depthInPanel = smoothstep(0.0, -0.045, sCard);
          transmittance *= (1.0 - depthInPanel * shadowDensity * 0.17 * u_cardVisible);
        }
      }

      // Subtle animated volumetric dust / atmospheric haze along the light shaft
      vec2 noiseCoord = samplePos * vec2(4.0, 5.2) + vec2(motionTime * 0.055, -motionTime * 0.04);
      float fogDensity = 0.72 + 0.56 * fbm(noiseCoord);

      float invSq = 1.0 / (1.0 + sampleDist * sampleDist * 7.8);
      float sampleAngle = dot((samplePos - la) / max(sampleDist, 0.0005), beamDir);
      float sampleCone = smoothstep(0.16, 0.75, sampleAngle) * 0.66 + smoothstep(0.68, 0.97, sampleAngle) * 0.54;

      accumScatter += transmittance * fogDensity * invSq * sampleCone * stepReach * (1.0 / float(MARCH_STEPS));
    }

    // Smooth anti-aliased architectural city-glass skyline silhouette on the studio lower horizon
    float horizonBand = smoothstep(0.30, 0.02, uv.y);
    float colIdx = floor(uv.x * 24.0);
    float bHeight = 0.045 + 0.135 * fract(sin(colIdx * 91.37 + 12.4) * 43758.5453);
    float towerBody = smoothstep(bHeight + 0.006, bHeight - 0.006, uv.y) * horizonBand;
    float roofRim = smoothstep(0.009, 0.0, abs(uv.y - bHeight)) * horizonBand;
    float mullionWave = smoothstep(0.76, 0.96, cos(uv.x * 220.0)) * smoothstep(0.55, 0.9, cos(uv.y * 145.0));
    float cityGlassSpec = (roofRim * 0.52 + towerBody * 0.14 + towerBody * mullionWave * 0.24)
      * wideCone * reachEnvelope * smoothstep(1.45, 0.12, dist);

    // Glass panel surface Fresnel rim & progressive directional wash
    float glassRim = 0.0;
    float glassSurfaceWash = 0.0;
    float prePullEdgeCatch = 0.0;
    if (u_cardRect.z > 0.01) {
      float edgeBand = exp(-abs(cardSdf) * 100.0);
      vec2 lampToCard = normalize(la - cardCenter);
      vec2 pixFromCenter = normalize(pa - cardCenter + vec2(0.0001));
      float facingFactor = smoothstep(-0.32, 0.78, dot(pixFromCenter, lampToCard));

      // Even before ignition, pulling the cord grazes a warm catchlight onto the darkened panel's lamp-facing edge
      prePullEdgeCatch = edgeBand * facingFactor * preWarmReach * 1.45;
      glassRim = edgeBand * facingFactor * u_cardVisible * reachEnvelope;

      // Progressive directional sheen sweeping from lamp across the glass panel
      float inCard = smoothstep(0.006, -0.012, cardSdf);
      float sweepDist = dot(pa - la, beamDir);
      float panelSweep = smoothstep(maxReach, max(0.0, maxReach - 0.42), sweepDist);
      glassSurfaceWash = inCard * facingFactor * panelSweep * (0.28 + 0.72 * coreCone) * u_cardVisible;
    }

    // Studio desk ground bounce pool along bottom plane connecting lamp base & panel lower edge
    float groundBand = exp(-pow((uv.y - 0.115) * 7.2, 2.0)) * smoothstep(1.08, 0.08, abs(pa.x - (la.x + 0.18)));
    float groundBounce = groundBand * (0.35 + 0.65 * wideCone) * reachEnvelope * transmittance;

    // Color grading: warm 2850K tungsten ivory core -> rich studio gold -> amber obsidian tail
    vec3 colIvoryCore = vec3(1.0, 0.96, 0.84);
    vec3 colGoldMid = vec3(0.94, 0.80, 0.42);
    vec3 colAmberTail = vec3(0.68, 0.48, 0.16);

    float activeEnergy = max(u_lightIntensity, u_cordPull * 0.28);
    float radialFade = exp(-dist * 1.38);

    vec3 lightColor = mix(colAmberTail, colGoldMid, smoothstep(0.0, 0.55, radialFade + coreCone * 0.35));
    lightColor = mix(lightColor, colIvoryCore, clamp(bulbCore * 1.2 + coreCone * radialFade * 0.55, 0.0, 1.0));

    float volumetricLum = (
      accumScatter * 1.62 * causticRibs * reachEnvelope +
      apertureScatter * 0.28 * max(reachEnvelope, preWarmReach * 1.8) +
      bulbCore * 0.44 * max(u_lightIntensity, u_cordPull * 0.48) +
      groundBounce * 0.18 +
      cityGlassSpec * 0.20 +
      glassRim * 0.46 +
      glassSurfaceWash * 0.15
    ) * activeEnergy + prePullEdgeCatch * 0.28;

    // Directional cast shadow darkening behind the login panel (deepened by cord angle)
    float castShadowMask = 0.0;
    if (u_cardVisible > 0.04 && cardSdf > 0.002) {
      castShadowMask = (1.0 - transmittance) * reachEnvelope * u_cardVisible * shadowDensity;
    }

    vec3 finalRgb = lightColor * volumetricLum;
    finalRgb = mix(finalRgb, vec3(0.01, 0.01, 0.015), clamp(castShadowMask * 0.48, 0.0, 0.48));

    // Triangular dither prevents 8-bit gradient banding on dark obsidian monitors
    float dither = (hash12(gl_FragCoord.xy + fract(u_time) * 19.0) - 0.5) / 255.0;
    finalRgb = max(vec3(0.0), finalRgb + dither);

    float alpha = clamp(volumetricLum * 1.28 + castShadowMask * 0.34, 0.0, 0.92);
    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const LampRaymarchShader: React.FC<LampRaymarchShaderProps> = ({
  isOn,
  isFocused,
  pullProgress,
  reducedMotion,
  apertureRef,
  panelRef,
  physicsRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const stateRef = useRef({
    isOn,
    isFocused,
    pullProgress,
    reducedMotion,
  });
  stateRef.current = { isOn, isFocused, pullProgress, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      setWebglFailed(true);
      return;
    }

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      setWebglFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      setWebglFailed(true);
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      setWebglFailed(true);
      return;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPositionLoc = gl.getAttribLocation(program, 'a_position');
    const uLocs = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      lampPos: gl.getUniformLocation(program, 'u_lampPos'),
      beamDir: gl.getUniformLocation(program, 'u_beamDir'),
      cardRect: gl.getUniformLocation(program, 'u_cardRect'),
      cardVisible: gl.getUniformLocation(program, 'u_cardVisible'),
      lightIntensity: gl.getUniformLocation(program, 'u_lightIntensity'),
      lightReach: gl.getUniformLocation(program, 'u_lightReach'),
      cordAngle: gl.getUniformLocation(program, 'u_cordAngle'),
      cordPull: gl.getUniformLocation(program, 'u_cordPull'),
      reducedMotion: gl.getUniformLocation(program, 'u_reducedMotion'),
    };

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);

    let rafId = 0;
    let lastTs = performance.now();
    let smoothIntensity = stateRef.current.isOn ? 1 : 0;
    let smoothReach = stateRef.current.isOn ? 1 : 0;
    let smoothCardVis = stateRef.current.isOn ? 1 : 0;
    let smoothLampX = 0.28;
    let smoothLampY = 0.62;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const {
        isOn: on,
        isFocused: focused,
        pullProgress: pullProp,
        reducedMotion: reduced,
      } = stateRef.current;

      const phys = physicsRef.current;
      const targetIntensity = on ? (focused ? 1.0 : 0.92) : 0.0;
      const targetReach = on ? 1.0 : 0.0;

      // Smooth progressive light extension ("يمتد تدريجياً") illuminating the darkened panel
      const intensityRate = reduced ? 24.0 : on ? 6.8 : 8.5;
      const reachRate = reduced ? 24.0 : on ? 3.1 : 7.8;
      smoothIntensity +=
        (targetIntensity - smoothIntensity) * (1 - Math.exp(-intensityRate * dt));
      smoothReach += (targetReach - smoothReach) * (1 - Math.exp(-reachRate * dt));
      smoothCardVis += ((on ? 1.0 : 0.0) - smoothCardVis) * (1 - Math.exp(-6.2 * dt));

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);

      const apertureEl = apertureRef.current;
      if (apertureEl) {
        const r = apertureEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const lx = (r.left + r.width * 0.5) / vw;
          const ly = 1.0 - (r.top + r.height * 0.5) / vh;
          smoothLampX += (lx - smoothLampX) * (1 - Math.exp(-22.0 * dt));
          smoothLampY += (ly - smoothLampY) * (1 - Math.exp(-22.0 * dt));
        }
      }

      let cardCx = 0.62;
      let cardCy = 0.48;
      let cardHw = 0.0;
      let cardHh = 0.0;
      const panelEl = panelRef.current;
      if (panelEl) {
        const pr = panelEl.getBoundingClientRect();
        if (pr.width > 8 && pr.height > 8) {
          cardCx = (pr.left + pr.width * 0.5) / vw;
          cardCy = 1.0 - (pr.top + pr.height * 0.5) / vh;
          cardHw = (pr.width * 0.5) / vw;
          cardHh = (pr.height * 0.5) / vh;
        }
      }

      // Live lamp head swivel angle -> WebGL Y-up beam unit vector:
      // Negative SVG angle (-44deg counter-clockwise) points mouth DOWN-RIGHT (+bx, -by).
      const rad = (phys.headAngleDeg * Math.PI) / 180;
      const bx = -Math.sin(rad);
      const by = -Math.cos(rad);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uLocs.resolution, canvas.width, canvas.height);
      gl.uniform1f(uLocs.time, now * 0.001);
      gl.uniform2f(uLocs.lampPos, smoothLampX, smoothLampY);
      gl.uniform2f(uLocs.beamDir, bx, by);
      gl.uniform4f(uLocs.cardRect, cardCx, cardCy, cardHw, cardHh);
      gl.uniform1f(uLocs.cardVisible, smoothCardVis);
      gl.uniform1f(uLocs.lightIntensity, smoothIntensity);
      gl.uniform1f(uLocs.lightReach, smoothReach);
      gl.uniform1f(uLocs.cordAngle, phys.cordSwayNorm);
      gl.uniform1f(uLocs.cordPull, Math.max(pullProp, phys.cordPullNorm));
      gl.uniform1f(uLocs.reducedMotion, reduced ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasSize);
      gl.deleteBuffer(posBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [apertureRef, panelRef, physicsRef]);

  if (webglFailed) {
    return (
      <div
        aria-hidden="true"
        data-testid="lamp-shader-fallback"
        className="pointer-events-none fixed inset-0 z-[2] transition-opacity duration-500"
        style={{
          opacity: isOn ? (isFocused ? 0.95 : 0.85) : pullProgress * 0.28,
          background:
            'radial-gradient(ellipse 64% 52% at 32% 38%, rgba(255, 240, 185, 0.22) 0%, rgba(212, 175, 55, 0.10) 42%, transparent 78%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="lamp-raymarch-shader"
      className="pointer-events-none fixed inset-0 z-[2] h-full w-full"
    />
  );
};
