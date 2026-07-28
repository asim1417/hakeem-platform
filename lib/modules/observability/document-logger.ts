import { createHash, randomUUID } from "node:crypto";

export type DocumentLogLevel = "info" | "warn" | "error";

export type DocumentLogEvent = {
  level?: DocumentLogLevel;
  event: string;
  correlationId: string;
  userId?: string;
  attachmentId?: string;
  jobId?: string;
  provider?: string;
  durationMs?: number;
  bytes?: number;
  status?: string;
  errorCode?: string;
  [key: string]: unknown;
};

const FORBIDDEN_KEYS = /^(url|rawUrl|query|token|authorization|cookie|documentText|text|signedUrl|content)$/i;

function hashUserId(userId?: string): string | undefined {
  if (!userId) return undefined;
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    if (typeof v === "string" && /https?:\/\//i.test(v) && v.includes("?")) continue;
    out[k] = v;
  }
  return out;
}

export function newCorrelationId(): string {
  return randomUUID();
}

export const createCorrelationId = newCorrelationId;

export function logDocumentEvent(input: DocumentLogEvent): void {
  const { level = "info", userId, ...rest } = input;
  const payload = sanitize({
    timestamp: new Date().toISOString(),
    level,
    userIdHash: hashUserId(userId),
    ...rest
  });
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const documentLog = logDocumentEvent;

/** يفشل الاختبار إن وُجدت مفاتيح محظورة في كائن السجل. */
export function assertSafeDocumentLogPayload(payload: Record<string, unknown>): string[] {
  const violations: string[] = [];
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.test(key)) violations.push(key);
  }
  const blob = JSON.stringify(payload);
  if (/access_token|X-Amz-Signature|X-Goog-Signature/i.test(blob)) {
    violations.push("sensitive-token-pattern");
  }
  return violations;
}
