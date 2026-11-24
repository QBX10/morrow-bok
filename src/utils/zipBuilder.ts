export interface ZipEntryInput {
  path: string;
  data: Uint8Array | string;
  lastModified?: Date;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function computeCrc32Hex(bytes: Uint8Array): string {
  return computeCrc32(bytes).toString(16).padStart(8, '0');
}

function encodeDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

async function tryDeflateRaw(raw: Uint8Array): Promise<{ compressed: Uint8Array; method: 0 | 8 }> {
  if (raw.length < 64 || typeof CompressionStream === 'undefined') {
    return { compressed: raw, method: 0 };
  }
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const copy = new Uint8Array(raw.length);
    copy.set(raw);
    void writer.write(copy);
    void writer.close();

    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLen >= raw.length) {
      return { compressed: raw, method: 0 };
    }
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { compressed: merged, method: 8 };
  } catch {
    return { compressed: raw, method: 0 };
  }
}

function normalizeZipPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

/**
 * Pure TypeScript ZIP builder supporting UTF-8 Arabic folder & file paths,
 * real CRC-32 checksums, and native deflate-raw compression when available.
 */
export async function buildZipArchive(
  entries: ZipEntryInput[],
  options?: { compress?: boolean }
): Promise<{
  bytes: Uint8Array;
  blob: Blob;
  crc32Hex: string;
  uncompressedBytes: number;
  compressedBytes: number;
}> {
  const encoder = new TextEncoder();
  const compress = options?.compress !== false;

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let totalUncompressed = 0;

  for (const entry of entries) {
    const cleanPath = normalizeZipPath(entry.path);
    if (!cleanPath) continue;

    const nameBytes = encoder.encode(cleanPath);
    const rawBytes =
      typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    totalUncompressed += rawBytes.length;

    const crc = computeCrc32(rawBytes);
    const { compressed, method } = compress
      ? await tryDeflateRaw(rawBytes)
      : { compressed: rawBytes, method: 0 as const };

    const { dosTime, dosDate } = encodeDosDateTime(entry.lastModified ?? new Date());
    const utf8Flag = 0x0800; // EFS bit for UTF-8 Arabic paths

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(localHeader.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true); // version needed
    lView.setUint16(6, utf8Flag, true);
    lView.setUint16(8, method, true);
    lView.setUint16(10, dosTime, true);
    lView.setUint16(12, dosDate, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, compressed.length, true);
    lView.setUint32(22, rawBytes.length, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true); // version made by
    cView.setUint16(6, 20, true); // version needed
    cView.setUint16(8, utf8Flag, true);
    cView.setUint16(10, method, true);
    cView.setUint16(12, dosTime, true);
    cView.setUint16(14, dosDate, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, compressed.length, true);
    cView.setUint32(24, rawBytes.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true); // extra length
    cView.setUint16(32, 0, true); // comment length
    cView.setUint16(34, 0, true); // disk number
    cView.setUint16(36, 0, true); // internal attrs
    cView.setUint32(38, 0, true); // external attrs
    cView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + compressed.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, centralParts.length, true);
  eView.setUint16(10, centralParts.length, true);
  eView.setUint32(12, centralSize, true);
  eView.setUint32(16, localOffset, true);
  eView.setUint16(20, 0, true);

  const totalLength = localOffset + centralSize + eocd.length;
  const output = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  output.set(eocd, cursor);

  const blob = new Blob([output], { type: 'application/zip' });
  return {
    bytes: output,
    blob,
    crc32Hex: computeCrc32Hex(output),
    uncompressedBytes: totalUncompressed,
    compressedBytes: output.length,
  };
}
