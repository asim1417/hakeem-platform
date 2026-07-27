import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import os from "os";

export function agentDataDir(): string {
  const override = process.env.HAKEEM_RASD_AGENT_HOME;
  if (override) return override;
  return path.join(os.homedir(), ".hakeem-rasd-agent");
}

export function ensureDataDir(): string {
  const dir = agentDataDir();
  mkdirSync(path.join(dir, "sandbox"), { recursive: true });
  mkdirSync(path.join(dir, "logs"), { recursive: true });
  return dir;
}

export interface AgentIdentity {
  agentId: string;
  displayName: string;
  publicKeyPem: string;
  privateKeyPem: string;
  platform: string;
  version: string;
  cloudBaseUrl: string;
  approvedSources: string[];
  pairedAt: string;
}

function identityPath(): string {
  return path.join(ensureDataDir(), "identity.json");
}

export function loadIdentity(): AgentIdentity | null {
  const p = identityPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as AgentIdentity;
}

export function saveIdentity(identity: AgentIdentity): void {
  writeFileSync(identityPath(), JSON.stringify(identity, null, 2), { mode: 0o600 });
}

export function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  };
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
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
  return sign(null, Buffer.from(canonicalJson(payload), "utf8"), key).toString("base64url");
}

export function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return verify(null, Buffer.from(canonicalJson(payload), "utf8"), key, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export function nonce(): string {
  return randomBytes(16).toString("hex");
}

export function detectPlatform(): string {
  const p = process.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  return "linux";
}

export const AGENT_VERSION = "0.1.0";
