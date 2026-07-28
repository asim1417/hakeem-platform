import { RASD_MAX_CHUNK_BYTES } from "./types";
import { bridgeStore, sha256FromStore } from "./chunk-helpers";

export function initChunkUpload(jobId: string, totalChunks: number, checksum: string): void {
  const { chunkStore } = bridgeStore();
  chunkStore.set(jobId, { chunks: new Map(), total: totalChunks, checksum });
}

export function putChunk(jobId: string, index: number, dataBase64: string): { ok: true } | { ok: false; errorCode: string } {
  if (Buffer.byteLength(dataBase64, "utf8") > RASD_MAX_CHUNK_BYTES * 2) {
    return { ok: false, errorCode: "CHUNK_TOO_LARGE" };
  }
  const { chunkStore } = bridgeStore();
  const entry = chunkStore.get(jobId);
  if (!entry) return { ok: false, errorCode: "UPLOAD_NOT_INITIALIZED" };
  try {
    Buffer.from(dataBase64, "base64");
  } catch {
    return { ok: false, errorCode: "CORRUPT_CHUNK" };
  }
  entry.chunks.set(index, dataBase64);
  return { ok: true };
}

export function assembleChunks(jobId: string): { ok: true; payload: string } | { ok: false; errorCode: string } {
  const { chunkStore } = bridgeStore();
  const entry = chunkStore.get(jobId);
  if (!entry || entry.total == null || !entry.checksum) return { ok: false, errorCode: "UPLOAD_NOT_INITIALIZED" };
  if (entry.chunks.size !== entry.total) return { ok: false, errorCode: "INCOMPLETE_UPLOAD" };
  const parts: string[] = [];
  for (let i = 0; i < entry.total; i += 1) {
    const part = entry.chunks.get(i);
    if (!part) return { ok: false, errorCode: "MISSING_CHUNK" };
    parts.push(Buffer.from(part, "base64").toString("utf8"));
  }
  const payload = parts.join("");
  if (sha256FromStore(payload) !== entry.checksum) return { ok: false, errorCode: "CHECKSUM_MISMATCH" };
  return { ok: true, payload };
}
