/** مخزن ذاكرة لروابط MCP — للاختبارات فقط (يحاكي ذرّية مخزن Prisma). */
import { randomBytes } from "node:crypto";
import type { AuthCodeRecord, ConsumeCodeResult, GrantRecord, GrantStore, RevokeReason } from "./store";

export class MemoryGrantStore implements GrantStore {
  codes = new Map<string, AuthCodeRecord>();
  grants = new Map<string, GrantRecord>();
  windows = new Map<string, number>();
  usedRefresh = new Map<string, string>();

  async createAuthCode(code: Omit<AuthCodeRecord, "usedAt" | "grantId">): Promise<void> {
    this.codes.set(code.codeHash, { ...code, usedAt: null, grantId: null });
  }

  async getAuthCode(codeHash: string): Promise<AuthCodeRecord | null> {
    const code = this.codes.get(codeHash);
    return code ? { ...code } : null;
  }

  async consumeAuthCode(codeHash: string, now: Date): Promise<ConsumeCodeResult> {
    const code = this.codes.get(codeHash);
    if (!code) return { status: "invalid" };
    if (code.usedAt) return { status: "reused", code: { ...code } };
    if (code.expiresAt.getTime() <= now.getTime()) return { status: "invalid" };
    code.usedAt = now;
    return { status: "ok", code: { ...code } };
  }

  async attachGrantToCode(codeHash: string, grantId: string): Promise<void> {
    const code = this.codes.get(codeHash);
    if (code) code.grantId = grantId;
  }

  async createGrant(input: Parameters<GrantStore["createGrant"]>[0]): Promise<GrantRecord> {
    const grant: GrantRecord = {
      id: `g_${randomBytes(8).toString("hex")}`,
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      redirectUri: input.redirectUri,
      resource: input.resource,
      scopes: [...input.scopes],
      refreshTokenHash: input.refreshTokenHash,
      previousRefreshHash: null,
      refreshRotatedAt: input.now,
      createdAt: input.now,
      lastUsedAt: input.now,
      revokedAt: null,
      revokedReason: null,
    };
    this.grants.set(grant.id, grant);
    return { ...grant };
  }

  async getGrant(id: string): Promise<GrantRecord | null> {
    const g = this.grants.get(id);
    return g ? { ...g } : null;
  }

  async findByRefreshHash(hash: string): Promise<GrantRecord | null> {
    for (const g of this.grants.values()) if (g.refreshTokenHash === hash) return { ...g };
    return null;
  }

  async findGrantIdByUsedRefresh(hash: string): Promise<string | null> {
    return this.usedRefresh.get(hash) ?? null;
  }

  async rotateRefresh(grantId: string, expectedHash: string, newHash: string, now: Date): Promise<boolean> {
    const g = this.grants.get(grantId);
    if (!g || g.revokedAt || g.refreshTokenHash !== expectedHash) return false;
    this.usedRefresh.set(expectedHash, grantId);
    g.previousRefreshHash = expectedHash;
    g.refreshTokenHash = newHash;
    g.refreshRotatedAt = now;
    g.lastUsedAt = now;
    return true;
  }

  async touch(grantId: string, now: Date): Promise<void> {
    const g = this.grants.get(grantId);
    if (g) g.lastUsedAt = now;
  }

  async revoke(grantId: string, reason: RevokeReason, now: Date): Promise<void> {
    const g = this.grants.get(grantId);
    if (g && !g.revokedAt) {
      g.revokedAt = now;
      g.revokedReason = reason;
      g.refreshTokenHash = null;
      g.previousRefreshHash = null;
    }
  }

  async listForUser(userId: string): Promise<GrantRecord[]> {
    return [...this.grants.values()].filter((g) => g.userId === userId).map((g) => ({ ...g }));
  }

  async hitWindow(key: string, windowStart: number): Promise<number> {
    const k = `${key}|${windowStart}`;
    const next = (this.windows.get(k) ?? 0) + 1;
    this.windows.set(k, next);
    return next;
  }
}
