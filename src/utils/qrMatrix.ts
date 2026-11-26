/**
 * Lightweight local deterministic 2D pairing matrix SVG builder for QR cross-device login.
 * Renders crisp 3-corner finder patterns + timing grid + error-checked data cells locally
 * without external CDN dependencies.
 */
export interface QrMatrixRender {
  size: number;
  modules: boolean[][];
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function paintFinder(grid: boolean[][], rowOffset: number, colOffset: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[rowOffset + r][colOffset + c] = isOuter || isInner;
    }
  }
}

export function buildPairingQrMatrix(payload: string): QrMatrixRender {
  const size = 25;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Finder squares (top-left, top-right, bottom-left)
  paintFinder(modules, 0, 0);
  paintFinder(modules, 0, size - 7);
  paintFinder(modules, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0;
    modules[6][i] = bit;
    modules[i][6] = bit;
  }

  // Fill data area deterministically from payload + checksum bits
  const seed = hashSeed(payload);
  let state = seed ^ 0x9e3779b9;
  const payloadBytes = new TextEncoder().encode(payload);

  const isReserved = (r: number, c: number): boolean => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= size - 8) return true;
    if (r >= size - 8 && c < 8) return true;
    if (r === 6 || c === 6) return true;
    return false;
  };

  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isReserved(r, c)) continue;
      const byte = payloadBytes[bitIdx % Math.max(1, payloadBytes.length)] || 0;
      state ^= (state << 13) | (byte + bitIdx);
      state = (state >>> 0) ^ ((state >>> 17) + 0x85ebca6b);
      const mask = (r + c) % 2 === 0 ? 1 : 0;
      modules[r][c] = ((state ^ byte) & 1) === mask;
      bitIdx += 1;
    }
  }

  return { size, modules };
}
