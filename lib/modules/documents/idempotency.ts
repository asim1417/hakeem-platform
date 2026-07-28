import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

export type IdempotencyLookup =
  | { status: "miss" }
  | { status: "conflict" }
  | { status: "replay"; responseCode: number; responseBody: unknown; entityId?: string | null }
  | { status: "inflight" };

/**
 * يبدأ سجل idempotency أو يعيد نتيجة سابقة.
 * لا يخزن URL الخام — يُمرَّر requestHash فقط.
 */
export async function beginIdempotency(input: {
  userId: string;
  scope: string;
  key: string;
  requestHash: string;
  ttlSeconds?: number;
}): Promise<IdempotencyLookup & { recordId?: string }> {
  const keyHash = hashIdempotencyKey(input.key);
  const existing = await prisma.apiIdempotencyRecord.findUnique({
    where: { userId_scope_keyHash: { userId: input.userId, scope: input.scope, keyHash } }
  });
  if (existing) {
    if (existing.expiresAt.getTime() < Date.now()) {
      await prisma.apiIdempotencyRecord.delete({ where: { id: existing.id } }).catch(() => undefined);
    } else if (existing.requestHash !== input.requestHash) {
      return { status: "conflict" };
    } else if (existing.status === "completed" && existing.responseCode != null) {
      return {
        status: "replay",
        responseCode: existing.responseCode,
        responseBody: existing.responseBody,
        entityId: existing.entityId
      };
    } else if (existing.status === "inflight") {
      return { status: "inflight" };
    } else if (existing.status === "failed") {
      await prisma.apiIdempotencyRecord.delete({ where: { id: existing.id } }).catch(() => undefined);
    }
  }

  const ttl = input.ttlSeconds ?? 24 * 3600;
  const record = await prisma.apiIdempotencyRecord.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      keyHash,
      requestHash: input.requestHash,
      status: "inflight",
      expiresAt: new Date(Date.now() + ttl * 1000)
    }
  });
  return { status: "miss", recordId: record.id };
}

export async function completeIdempotency(input: {
  recordId: string;
  responseCode: number;
  responseBody: unknown;
  entityId?: string;
}): Promise<void> {
  await prisma.apiIdempotencyRecord.update({
    where: { id: input.recordId },
    data: {
      status: "completed",
      responseCode: input.responseCode,
      responseBody: input.responseBody as object,
      entityId: input.entityId
    }
  });
}

export async function failIdempotency(recordId: string): Promise<void> {
  await prisma.apiIdempotencyRecord.update({
    where: { id: recordId },
    data: { status: "failed" }
  });
}

/** أسماء بديلة للتوافق مع مسارات الاستيراد */
export async function beginIdempotentRequest(input: {
  userId: string;
  scope: string;
  key: string;
  requestHash: string;
  ttlSeconds?: number;
}): Promise<
  | { kind: "miss"; recordId: string }
  | { kind: "conflict" }
  | { kind: "in_progress" }
  | { kind: "replay"; responseCode: number; responseBody: unknown; entityId?: string | null }
> {
  const result = await beginIdempotency(input);
  if (result.status === "miss" && result.recordId) return { kind: "miss", recordId: result.recordId };
  if (result.status === "conflict") return { kind: "conflict" };
  if (result.status === "inflight") return { kind: "in_progress" };
  if (result.status === "replay") {
    return {
      kind: "replay",
      responseCode: result.responseCode,
      responseBody: result.responseBody,
      entityId: result.entityId
    };
  }
  return { kind: "conflict" };
}

export async function completeIdempotentRequest(input: {
  recordId: string;
  responseCode: number;
  responseBody: unknown;
  entityId?: string;
}): Promise<void> {
  return completeIdempotency(input);
}

export async function failIdempotentRequest(recordId: string): Promise<void> {
  return failIdempotency(recordId);
}
