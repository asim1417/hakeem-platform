/**
 * من يستدعي /mcp؟ يحوّل الترويسة إلى «صاحب طلب» واحد تحمله AuthInfo.extra إلى الأدوات:
 *  - internal : المفتاح المشترك أو رموز hk1 القديمة (فريق أمان، انتقالي).
 *  - user     : مستخدم حكيم عبر ربط (تصريح hk2) أو مفتاح شخصي (hk_live_… بنطاق mcp:read).
 *  - open     : خادم مفتوح صراحةً (HAKEEM_MCP_ALLOW_OPEN=1) بلا مصادقة.
 */
import { accountLinkingEnabled, mcpSharedKey, mcpTokenSecret } from "@/lib/mcp/config";
import { audienceAccepted, verifyMcpAccessToken } from "@/lib/mcp/oauth";
import { getGrantStore } from "@/lib/mcp/grants/prisma-store";
import { MCP_SCOPE, verifyGrantAccessToken } from "@/lib/mcp/grants/service";
import { hashApiKey, looksLikeApiKey } from "@/lib/modules/api-gateway/api-keys";

export type McpPrincipal =
  | { kind: "internal"; via: "shared_key" | "legacy_token"; clientId: string }
  | { kind: "open" }
  | { kind: "user"; via: "grant"; userId: string; grantId: string; clientId: string }
  | { kind: "user"; via: "api_key"; userId: string; apiKeyId: string; clientId: string; rateLimit: number };

export type McpAuthInfo = {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  extra: { principal: McpPrincipal };
};

type ApiKeyRow = {
  id: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  expiresAt: Date | null;
  userId: string | null;
  rateLimit: number;
  lastUsedAt: Date | null;
};

export type PrincipalDeps = {
  isUserActive(userId: string): Promise<boolean>;
  findApiKeyByHash(hash: string): Promise<ApiKeyRow | null>;
  touchApiKey(id: string): Promise<void>;
};

const prismaDeps: PrincipalDeps = {
  async isUserActive(userId) {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    return user?.isActive === true;
  },
  async findApiKeyByHash(hash) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.apiKey.findUnique({
      where: { keyHash: hash },
      select: { id: true, keyPrefix: true, scopes: true, active: true, expiresAt: true, userId: true, rateLimit: true, lastUsedAt: true },
    });
  },
  async touchApiKey(id) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() }, select: { id: true } });
  },
};

let depsOverride: PrincipalDeps | null = null;

/** للاختبارات فقط. */
export function setPrincipalDepsForTests(deps: PrincipalDeps | null): void {
  depsOverride = deps;
}

function deps(): PrincipalDeps {
  return depsOverride ?? prismaDeps;
}

/** يتحقق من بيانات الطلب ويعيد AuthInfo بصاحب الطلب، أو undefined (401). */
export async function verifyMcpRequest(request: Request, bearer?: string): Promise<McpAuthInfo | undefined> {
  const presented = bearer?.trim() || request.headers.get("x-api-key")?.trim() || "";
  if (!presented) return undefined;

  // ١) المسار القديم: المفتاح المشترك أو رمز hk1 (ما لم يُوقف المفتاح المشترك).
  const shared = mcpSharedKey();
  if (shared) {
    const legacy = verifyMcpAccessToken(request, presented, shared);
    if (legacy) {
      return {
        ...legacy,
        extra: {
          principal: {
            kind: "internal",
            via: legacy.clientId === "hakeem-api-key" ? "shared_key" : "legacy_token",
            clientId: legacy.clientId,
          },
        },
      };
    }
  }

  // الربط بالحساب والمفاتيح الشخصية يعملان فقط والعلم مفعّل: إطفاؤه يوقفهما كليًا (تراجع نظيف).
  if (!accountLinkingEnabled()) return undefined;

  // ٢) تصريح الربط بالحساب.
  const secret = mcpTokenSecret();
  if (secret && presented.startsWith("hk2.")) {
    const verified = await verifyGrantAccessToken({
      store: getGrantStore(),
      secret,
      token: presented,
      audienceAccepted: (aud) => audienceAccepted(aud, request),
    }).catch(() => null);
    if (!verified) return undefined;
    if (!(await deps().isUserActive(verified.userId).catch(() => false))) return undefined;
    return {
      token: presented,
      clientId: verified.clientId,
      scopes: [MCP_SCOPE],
      expiresAt: verified.expiresAt,
      extra: {
        principal: { kind: "user", via: "grant", userId: verified.userId, grantId: verified.grantId, clientId: verified.clientId },
      },
    };
  }

  // ٣) المفتاح الشخصي.
  if (looksLikeApiKey(presented)) {
    const key = await deps().findApiKeyByHash(hashApiKey(presented)).catch(() => null);
    if (!key || !key.active || !key.userId || !key.scopes.includes(MCP_SCOPE)) return undefined;
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return undefined;
    if (!(await deps().isUserActive(key.userId).catch(() => false))) return undefined;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 5 * 60 * 1000) {
      await deps().touchApiKey(key.id).catch(() => undefined);
    }
    const clientId = `api-key:${key.keyPrefix}`;
    return {
      token: presented,
      clientId,
      scopes: [MCP_SCOPE],
      extra: {
        principal: { kind: "user", via: "api_key", userId: key.userId, apiKeyId: key.id, clientId, rateLimit: key.rateLimit },
      },
    };
  }

  return undefined;
}

/** صاحب الطلب من سياق الأداة (ctx.http.authInfo.extra.principal). */
export function principalFromContext(ctx: unknown): McpPrincipal | null {
  const extra = (ctx as { http?: { authInfo?: { extra?: { principal?: unknown } } } } | undefined)?.http?.authInfo?.extra;
  const principal = extra?.principal as McpPrincipal | undefined;
  if (!principal || typeof principal !== "object" || !("kind" in principal)) return null;
  return principal;
}
