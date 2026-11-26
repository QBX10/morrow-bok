import {
  computeSha256Hex,
  smartCompressBinary,
} from '../compression/compressionEngine.ts';
import type { StorageQuotaInfo } from '../../types/agency.ts';

export const DEFAULT_CHUNK_SIZE_BYTES = 32 * 1024; // 32 KB

export interface DataChunkItem {
  hash: string;
  index: number;
  sizeBytes: number;
  base64Data: string;
}

export interface ChunkedPayloadBuild {
  manifestId: string;
  alg: 'gzip' | 'raw-skipped' | 'raw-unshrunk';
  rawBytes: number;
  compressedBytes: number;
  totalChunks: number;
  chunkHashes: string[];
  chunks: DataChunkItem[];
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/**
 * Splits a binary or JSON workspace payload into content-addressed SHA-256 chunks
 * so only modified/missing chunks ever cross the network.
 */
export async function buildContentAddressedChunks(
  input: Uint8Array | string,
  meta: {
    mimeType?: string;
    filename?: string;
    chunkSizeBytes?: number;
  } = {}
): Promise<ChunkedPayloadBuild> {
  const rawBytesArr =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const compressed = await smartCompressBinary(rawBytesArr, meta);
  const chunkSize = Math.max(
    4096,
    meta.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES
  );

  const chunks: DataChunkItem[] = [];
  const chunkHashes: string[] = [];
  const data = compressed.bytes;
  let index = 0;

  for (let offset = 0; offset < data.byteLength; offset += chunkSize) {
    const slice = data.subarray(
      offset,
      Math.min(data.byteLength, offset + chunkSize)
    );
    const hash = await computeSha256Hex(slice);
    chunks.push({
      hash,
      index,
      sizeBytes: slice.byteLength,
      base64Data: toBase64(slice),
    });
    chunkHashes.push(hash);
    index += 1;
  }

  if (chunks.length === 0) {
    const emptyHash = await computeSha256Hex(new Uint8Array(0));
    chunks.push({
      hash: emptyHash,
      index: 0,
      sizeBytes: 0,
      base64Data: '',
    });
    chunkHashes.push(emptyHash);
  }

  const manifestSeed = new TextEncoder().encode(
    `${compressed.alg}:${compressed.rawBytes}:${chunkHashes.join(',')}`
  );
  const manifestId = (await computeSha256Hex(manifestSeed)).slice(0, 24);

  return {
    manifestId,
    alg: compressed.alg,
    rawBytes: compressed.rawBytes,
    compressedBytes: compressed.outputBytes,
    totalChunks: chunks.length,
    chunkHashes,
    chunks,
  };
}

export interface ChunkTransportClient {
  checkMissingChunks(hashes: string[]): Promise<string[]>;
  uploadChunk(chunk: DataChunkItem): Promise<void>;
  commitManifest(params: {
    manifestId: string;
    alg: string;
    rawBytes: number;
    compressedBytes: number;
    chunkHashes: string[];
    label?: string;
  }): Promise<{ ok: boolean; quota: StorageQuotaInfo }>;
}

export interface ResumableChunkUploadResult {
  manifestId: string;
  totalChunks: number;
  uploadedChunksCount: number;
  deduplicatedChunksCount: number;
  quota?: StorageQuotaInfo;
}

/**
 * Uploads a chunked payload with full deduplication & resume support:
 * if network drops mid-upload, re-running queries missing chunks from the server
 * and uploads ONLY the remaining chunks.
 */
export async function uploadChunkedWithDedupAndResume(
  build: ChunkedPayloadBuild,
  transport: ChunkTransportClient,
  options?: {
    label?: string;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<ResumableChunkUploadResult> {
  const uniqueChunksByHash = new Map<string, DataChunkItem>();
  for (const chunk of build.chunks) {
    if (!uniqueChunksByHash.has(chunk.hash)) {
      uniqueChunksByHash.set(chunk.hash, chunk);
    }
  }
  const uniqueHashes = Array.from(uniqueChunksByHash.keys());
  const missingHashes = await transport.checkMissingChunks(uniqueHashes);
  const missingSet = new Set(missingHashes);
  const toUpload = uniqueHashes
    .filter((h) => missingSet.has(h))
    .map((h) => uniqueChunksByHash.get(h)!)
    .filter(Boolean);

  let uploadedChunksCount = 0;
  for (const chunk of toUpload) {
    await transport.uploadChunk(chunk);
    uploadedChunksCount += 1;
    options?.onProgress?.(uploadedChunksCount, toUpload.length);
  }

  const commitRes = await transport.commitManifest({
    manifestId: build.manifestId,
    alg: build.alg,
    rawBytes: build.rawBytes,
    compressedBytes: build.compressedBytes,
    chunkHashes: build.chunkHashes,
    label: options?.label,
  });

  return {
    manifestId: build.manifestId,
    totalChunks: build.totalChunks,
    uploadedChunksCount,
    deduplicatedChunksCount: Math.max(0, build.totalChunks - uploadedChunksCount),
    quota: commitRes.quota,
  };
}
