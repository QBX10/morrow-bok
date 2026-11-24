import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function detectSoftwareWebGL(): {
  supported: boolean;
  isSoftwareGl: boolean;
  rendererName: string;
} {
  if (typeof document === 'undefined') {
    return { supported: false, isSoftwareGl: true, rendererName: 'ssr' };
  }

  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;

  try {
    const gl =
      (probe.getContext('webgl2', {
        failIfMajorPerformanceCaveat: false,
      }) as WebGL2RenderingContext | null) ||
      (probe.getContext('webgl', {
        failIfMajorPerformanceCaveat: false,
      }) as WebGLRenderingContext | null);

    if (!gl) {
      return { supported: false, isSoftwareGl: true, rendererName: 'unavailable' };
    }

    let rendererName = String(gl.getParameter(gl.RENDERER) || '');
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      if (unmasked) rendererName = String(unmasked);
    }

    const isSoftwareGl =
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);

    const loseExt = gl.getExtension('WEBGL_lose_context');
    if (loseExt) {
      loseExt.loseContext();
    }

    return {
      supported: true,
      isSoftwareGl,
      rendererName,
    };
  } catch {
    return { supported: false, isSoftwareGl: true, rendererName: 'error' };
  }
}

export function createRoomEnvPMREM(renderer: THREE.WebGLRenderer): {
  envMap: THREE.Texture;
  dispose: () => void;
} {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const renderTarget = pmrem.fromScene(roomEnv, 0.04);
  roomEnv.dispose();

  return {
    envMap: renderTarget.texture,
    dispose: () => {
      renderTarget.dispose();
      pmrem.dispose();
    },
  };
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => disposeMaterial(m));
    } else if (mat) {
      disposeMaterial(mat);
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  const anyMat = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyMat)) {
    const val = anyMat[key];
    if (val && typeof val === 'object' && 'isTexture' in val) {
      (val as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}

export interface FrameLoopController {
  start: () => void;
  stop: () => void;
}

/**
 * Hardware-friendly vs SwiftShader-paced render scheduler.
 * On software GL, avoids flooding the compositor with unpaced rAF calls.
 */
export function createAdaptiveRenderLoop(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  onFrame: (elapsedSec: number, deltaSec: number) => void,
  softwareMinDelayMs = 56
): FrameLoopController {
  let active = false;
  let rafId = 0;
  let timerId = 0;
  let lastTime = performance.now();
  const startTime = lastTime;

  const scheduleNext = () => {
    if (!active) return;
    if (isSoftwareGl) {
      timerId = window.setTimeout(() => {
        if (!active) return;
        rafId = window.requestAnimationFrame(step);
      }, softwareMinDelayMs);
    } else {
      rafId = window.requestAnimationFrame(step);
    }
  };

  const step = (now: number) => {
    if (!active) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const elapsed = (now - startTime) / 1000;

    onFrame(elapsed, dt);

    if (isSoftwareGl) {
      const gl = renderer.getContext();
      if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
        try {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          if (sync) {
            gl.flush();
            const pollFence = () => {
              if (!active) {
                gl.deleteSync(sync);
                return;
              }
              const status = gl.clientWaitSync(sync, 0, 0);
              if (status === gl.TIMEOUT_EXPIRED) {
                timerId = window.setTimeout(pollFence, 16);
                return;
              }
              gl.deleteSync(sync);
              scheduleNext();
            };
            timerId = window.setTimeout(pollFence, 16);
            return;
          }
        } catch {
          // Fall through to standard software delay
        }
      }
    }

    scheduleNext();
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(step);
    },
    stop: () => {
      active = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
    },
  };
}
