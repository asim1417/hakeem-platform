import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from "crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateAgentKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  };
}

export function generateNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function generatePairingCode(): string {
  // Human-friendly one-time code (no ambiguous chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) out += alphabet[buf[i]! % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(",")}}`;
}

export function signPayload(privateKeyPem: string, payload: unknown): string {
  const key = createPrivateKey(privateKeyPem);
  const data = Buffer.from(canonicalJson(payload), "utf8");
  return sign(null, data, key).toString("base64url");
}

export function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    const data = Buffer.from(canonicalJson(payload), "utf8");
    return verify(null, data, key, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export function signRequest(privateKeyPem: string, parts: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
}): string {
  return signPayload(privateKeyPem, parts);
}

export function verifyRequest(
  publicKeyPem: string,
  parts: { method: string; path: string; timestamp: string; nonce: string; bodyHash: string },
  signature: string
): boolean {
  return verifyPayload(publicKeyPem, parts, signature);
}

export function isTimestampFresh(iso: string, skewMs = 5 * 60 * 1000): boolean {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= skewMs;
}

/** Platform signing key for job envelopes (env or ephemeral for tests). */
let cachedPlatformKeys: { publicKeyPem: string; privateKeyPem: string } | null = null;

export function getPlatformSigningKeys(): { publicKeyPem: string; privateKeyPem: string } {
  const priv = process.env.RASD_BRIDGE_PLATFORM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const pub = process.env.RASD_BRIDGE_PLATFORM_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (priv && pub) return { privateKeyPem: priv, publicKeyPem: pub };
  if (!cachedPlatformKeys) cachedPlatformKeys = generateAgentKeyPair();
  return cachedPlatformKeys;
}

export function resetPlatformSigningKeysForTests(): void {
  cachedPlatformKeys = null;
}
