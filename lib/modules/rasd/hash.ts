import { createHash } from "crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function fingerprintObject(obj: unknown): string {
  return sha256Hex(stableSerialize(obj));
}

export function contentFingerprint(raw: string | Buffer): string {
  return sha256Hex(raw);
}

export function dualFingerprints(raw: string | Buffer, normalized: string): { rawHash: string; normalizedHash: string } {
  return {
    rawHash: contentFingerprint(raw),
    normalizedHash: sha256Hex(normalized)
  };
}
