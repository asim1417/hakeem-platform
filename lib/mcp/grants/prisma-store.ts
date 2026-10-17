/** مخزن Prisma لروابط MCP (الإنتاج). كل الاستهلاك والتدوير ذرّي عبر updateMany المشروط. */
import type { AuthCodeRecord, ConsumeCodeResult, GrantRecord, GrantStore, RevokeReason } from "./store";

let overrideStore: GrantStore | null = null;

/** للاختبارات فقط: استبدال المخزن الفعلي بمخزن ذاكرة. */
export function setGrantStoreForTests(store: GrantStore | null): void {
  overrideStore = store;
}

export function getGrantStore(): GrantStore {
  return overrideStore ?? prismaGrantStore;
}

/** تحميل كسول لعميل Prisma حتى لا يُنشأ الاتصال عند مجرد استيراد الوحدة (المسارات والاختبارات). */
async function db() {
  return (await import("@/lib/prisma")).prisma;
}

export const prismaGrantStore: GrantStore = {
  async createAuthCode(code) {
    await (await db()).mcpAuthCode.create({ data: { ...code } });
  },

  async getAuthCode(codeHash) {
    return (await (await db()).mcpAuthCode.findUnique({ where: { codeHash } })) as AuthCodeRecord | null;
  },

  async consumeAuthCode(codeHash, now): Promise<ConsumeCodeResult> {
    const prisma = await db();
    const updated = await prisma.mcpAuthCode.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    const code = (await prisma.mcpAuthCode.findUnique({ where: { codeHash } })) as AuthCodeRecord | null;
    if (!code) return { status: "invalid" };
    if (updated.count === 1) return { status: "ok", code };
    return code.usedAt ? { status: "reused", code } : { status: "invalid" };
  },

  async attachGrantToCode(codeHash, grantId) {
    await (await db()).mcpAuthCode.update({ where: { codeHash }, data: { grantId } });
  },

  async createGrant(input): Promise<GrantRecord> {
    return (await db()).mcpGrant.create({
      data: {
        userId: input.userId,
        clientId: input.clientId,
        clientName: input.clientName,
        redirectUri: input.redirectUri,
        resource: input.resource,
        scopes: input.scopes,
        refreshTokenHash: input.refreshTokenHash,
        refreshRotatedAt: input.now,
        createdAt: input.now,
        lastUsedAt: input.now,
      },
    });
  },

  async getGrant(id) {
    return (await db()).mcpGrant.findUnique({ where: { id } });
  },

  async findByRefreshHash(hash) {
    return (await db()).mcpGrant.findUnique({ where: { refreshTokenHash: hash } });
  },

  async findGrantIdByUsedRefresh(hash) {
    const row = await (await db()).mcpUsedRefreshToken.findUnique({ where: { tokenHash: hash }, select: { grantId: true } });
    return row?.grantId ?? null;
  },

  async rotateRefresh(grantId, expectedHash, newHash, now) {
    const prisma = await db();
    const res = await prisma.mcpGrant.updateMany({
      where: { id: grantId, refreshTokenHash: expectedHash, revokedAt: null },
      data: { previousRefreshHash: expectedHash, refreshTokenHash: newHash, refreshRotatedAt: now, lastUsedAt: now },
    });
    if (res.count !== 1) return false;
    // سلسلة الرموز المستعمَلة: أي رمز قديم يعود لاحقًا يكشف السرقة ولو تجاوز السارق التدوير مرات.
    await prisma.mcpUsedRefreshToken
      .create({ data: { tokenHash: expectedHash, grantId, rotatedAt: now } })
      .catch(() => undefined);
    return true;
  },

  async touch(grantId, now) {
    await (await db()).mcpGrant.updateMany({ where: { id: grantId }, data: { lastUsedAt: now } });
  },

  async revoke(grantId, reason: RevokeReason, now) {
    const prisma = await db();
    await prisma.mcpGrant.updateMany({
      where: { id: grantId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason, refreshTokenHash: null, previousRefreshHash: null },
    });
    await prisma.mcpUsedRefreshToken.deleteMany({ where: { grantId } }).catch(() => undefined);
  },

  async listForUser(userId) {
    return (await db()).mcpGrant.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  },

  async hitWindow(key, windowStart) {
    const row = await (await db()).mcpRequestWindow.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    // تنظيف عرضي للنوافذ القديمة (أفضل جهد) حتى لا يكبر الجدول.
    if (Math.random() < 0.01) {
      await (await db()).mcpRequestWindow.deleteMany({ where: { windowStart: { lt: windowStart - 120 } } }).catch(() => undefined);
    }
    return row.count;
  },
};
