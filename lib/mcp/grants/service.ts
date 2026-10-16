/**
 * منطق الربط بالحساب (مستقل عن HTTP وعن قاعدة البيانات عبر GrantStore):
 * إصدار رمز التفويض، استبداله بتصاريح، التجديد مع التدوير وكشف إعادة الاستعمال، والتحقق.
 */
import type { GrantRecord, GrantStore } from "./store";
import {
  ACCESS_TTL_SEC,
  AUTH_CODE_TTL_SEC,
  GRANT_IDLE_TTL_SEC,
  REFRESH_REUSE_GRACE_SEC,
  hashToken,
  isPkceVerifier,
  newAuthCode,
  newRefreshToken,
  readAccessToken,
  s256,
  signAccessToken,
  type PendingAuthorization,
} from "./tokens";

export const MCP_SCOPE = "mcp:read";
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type TokenSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  scope: "mcp:read";
};

export type OAuthFailure = { error: "invalid_grant" | "invalid_client" };

export type VerifiedGrant = {
  userId: string;
  grantId: string;
  clientId: string;
  expiresAt: number;
};

/** اسم التطبيق للعرض، من عنوان الرجوع (مقيّد بقائمة بيضاء فلا يُنتحل). */
export function clientDisplayName(redirectUri: string): string {
  try {
    const host = new URL(redirectUri).hostname;
    if (host === "claude.ai" || host.endsWith(".claude.ai") || host === "claude.com" || host.endsWith(".claude.com")) {
      return "Claude";
    }
    if (host === "chatgpt.com" || host.endsWith(".chatgpt.com")) return "ChatGPT";
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return "أداة محلية (مطوّر)";
  } catch {
    /* يسقط إلى الاسم العام */
  }
  return "تطبيق خارجي";
}

function issue(secret: string, grant: Pick<GrantRecord, "id" | "userId" | "clientId" | "resource">, refresh: string, now: Date): TokenSuccess {
  const nowS = Math.floor(now.getTime() / 1000);
  return {
    access_token: signAccessToken(secret, {
      sub: grant.userId,
      gid: grant.id,
      cid: grant.clientId,
      aud: grant.resource,
      exp: nowS + ACCESS_TTL_SEC,
    }),
    refresh_token: refresh,
    expires_in: ACCESS_TTL_SEC,
    token_type: "Bearer",
    scope: "mcp:read",
  };
}

/** بعد «موافق»: يحفظ رمز تفويض لمرة واحدة ويعيده خامًا ليُرسل إلى عنوان الرجوع. */
export async function issueAuthorizationCode(input: {
  store: GrantStore;
  userId: string;
  pending: PendingAuthorization;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const code = newAuthCode();
  await input.store.createAuthCode({
    codeHash: hashToken(code),
    userId: input.userId,
    clientId: input.pending.cid,
    clientName: clientDisplayName(input.pending.ru),
    redirectUri: input.pending.ru,
    codeChallenge: input.pending.cc,
    resource: input.pending.res,
    scopes: [MCP_SCOPE],
    expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_SEC * 1000),
  });
  return code;
}

/** استبدال رمز التفويض بتصريح وصول + رمز تجديد، وإنشاء الربط. */
export async function exchangeAuthorizationCode(input: {
  store: GrantStore;
  secret: string;
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  now?: Date;
}): Promise<TokenSuccess | OAuthFailure> {
  const now = input.now ?? new Date();
  if (!input.code.startsWith("hka_") || !isPkceVerifier(input.codeVerifier)) return { error: "invalid_grant" };

  const codeHash = hashToken(input.code);
  const consumed = await input.store.consumeAuthCode(codeHash, now);
  if (consumed.status === "reused") {
    // رمز استُعمل من قبل: علامة اعتراض — نلغي الربط الذي صدر منه.
    if (consumed.code.grantId) await input.store.revoke(consumed.code.grantId, "code_reuse", now);
    return { error: "invalid_grant" };
  }
  if (consumed.status !== "ok") return { error: "invalid_grant" };

  const code = consumed.code;
  if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri) return { error: "invalid_grant" };
  if (s256(input.codeVerifier) !== code.codeChallenge) return { error: "invalid_grant" };

  await input.store.revokeActiveFor(code.userId, code.clientId, "relinked", now);
  const refresh = newRefreshToken();
  const grant = await input.store.createGrant({
    userId: code.userId,
    clientId: code.clientId,
    clientName: code.clientName,
    redirectUri: code.redirectUri,
    resource: code.resource,
    scopes: code.scopes,
    refreshTokenHash: hashToken(refresh),
    now,
  });
  await input.store.attachGrantToCode(codeHash, grant.id);
  return issue(input.secret, grant, refresh, now);
}

/** تجديد التصريح: تدوير رمز التجديد، وإلغاء الربط عند إعادة استعمال رمز قديم. */
export async function refreshAccessToken(input: {
  store: GrantStore;
  secret: string;
  refreshToken: string;
  clientId?: string;
  now?: Date;
}): Promise<TokenSuccess | OAuthFailure> {
  const now = input.now ?? new Date();
  if (!input.refreshToken.startsWith("hkr_")) return { error: "invalid_grant" };
  const hash = hashToken(input.refreshToken);

  const grant = await input.store.findByRefreshHash(hash);
  if (!grant) {
    const previous = await input.store.findByPreviousRefreshHash(hash);
    if (previous && !previous.revokedAt) {
      const rotatedAt = previous.refreshRotatedAt?.getTime() ?? 0;
      const withinGrace = now.getTime() - rotatedAt <= REFRESH_REUSE_GRACE_SEC * 1000;
      // تجديدان متزامنان من العميل نفسه مقبولان كسباق؛ بعد نافذة السماح = سرقة محتملة.
      if (!withinGrace) await input.store.revoke(previous.id, "refresh_reuse", now);
    }
    return { error: "invalid_grant" };
  }
  if (grant.revokedAt) return { error: "invalid_grant" };
  if (input.clientId && input.clientId !== grant.clientId) return { error: "invalid_grant" };

  const lastUsed = (grant.lastUsedAt ?? grant.createdAt).getTime();
  if (now.getTime() - lastUsed > GRANT_IDLE_TTL_SEC * 1000) {
    await input.store.revoke(grant.id, "idle", now);
    return { error: "invalid_grant" };
  }

  const next = newRefreshToken();
  const rotated = await input.store.rotateRefresh(grant.id, hash, hashToken(next), now);
  if (!rotated) return { error: "invalid_grant" };
  return issue(input.secret, grant, next, now);
}

/** التحقق من تصريح وصول: التوقيع، الانتهاء، المورد، وأن الربط غير ملغى. */
export async function verifyGrantAccessToken(input: {
  store: GrantStore;
  secret: string;
  token: string;
  audienceAccepted: (aud: string) => boolean;
  now?: Date;
}): Promise<VerifiedGrant | null> {
  const now = input.now ?? new Date();
  const claims = readAccessToken(input.secret, input.token, Math.floor(now.getTime() / 1000));
  if (!claims || !input.audienceAccepted(claims.aud)) return null;
  const grant = await input.store.getGrant(claims.gid);
  if (!grant || grant.revokedAt || grant.userId !== claims.sub || grant.clientId !== claims.cid) return null;
  const last = grant.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - last > TOUCH_EVERY_MS) {
    await input.store.touch(grant.id, now).catch(() => undefined);
  }
  return { userId: grant.userId, grantId: grant.id, clientId: grant.clientId, expiresAt: claims.exp };
}

/** إلغاء ربط يملكه المستخدم (أو أي ربط للمشرف). */
export async function revokeGrant(input: {
  store: GrantStore;
  grantId: string;
  actor: { userId: string; isAdmin: boolean };
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const grant = await input.store.getGrant(input.grantId);
  if (!grant) return false;
  if (!input.actor.isAdmin && grant.userId !== input.actor.userId) return false;
  if (grant.revokedAt) return true;
  await input.store.revoke(grant.id, input.actor.isAdmin && grant.userId !== input.actor.userId ? "admin" : "user", now);
  return true;
}
