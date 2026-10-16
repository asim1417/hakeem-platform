/**
 * عقد تخزين روابط MCP — ينفّذه مخزن Prisma في الإنتاج ومخزن الذاكرة في الاختبارات.
 * كل عمليات الاستهلاك/التدوير ذرّية (compare-and-swap) حتى لا يُستعمل رمز مرتين في سباق.
 */
export type GrantRecord = {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  refreshTokenHash: string | null;
  previousRefreshHash: string | null;
  refreshRotatedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
};

export type AuthCodeRecord = {
  codeHash: string;
  userId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scopes: string[];
  expiresAt: Date;
  usedAt: Date | null;
  grantId: string | null;
};

export type ConsumeCodeResult =
  | { status: "ok"; code: AuthCodeRecord }
  | { status: "reused"; code: AuthCodeRecord }
  | { status: "invalid" };

export type RevokeReason = "user" | "admin" | "relinked" | "refresh_reuse" | "code_reuse" | "idle";

export interface GrantStore {
  createAuthCode(code: Omit<AuthCodeRecord, "usedAt" | "grantId">): Promise<void>;
  /** يعلّم الرمز مستعملًا إن كان صالحًا وغير مستعمل (ذرّيًا). */
  consumeAuthCode(codeHash: string, now: Date): Promise<ConsumeCodeResult>;
  attachGrantToCode(codeHash: string, grantId: string): Promise<void>;

  createGrant(input: {
    userId: string;
    clientId: string;
    clientName: string;
    redirectUri: string;
    resource: string;
    scopes: string[];
    refreshTokenHash: string;
    now: Date;
  }): Promise<GrantRecord>;
  getGrant(id: string): Promise<GrantRecord | null>;
  findByRefreshHash(hash: string): Promise<GrantRecord | null>;
  findByPreviousRefreshHash(hash: string): Promise<GrantRecord | null>;
  /** يستبدل رمز التجديد إن كان الحالي ما زال expectedHash (ذرّيًا). */
  rotateRefresh(grantId: string, expectedHash: string, newHash: string, now: Date): Promise<boolean>;
  touch(grantId: string, now: Date): Promise<void>;
  revoke(grantId: string, reason: RevokeReason, now: Date): Promise<void>;
  /** يلغي الروابط النشطة السابقة للمستخدم مع العميل نفسه (إعادة الربط). */
  revokeActiveFor(userId: string, clientId: string, reason: RevokeReason, now: Date): Promise<number>;
  listForUser(userId: string): Promise<GrantRecord[]>;

  /** عدّاد نافذة الدقيقة: يزيد ويعيد العدد بعد الزيادة. */
  hitWindow(key: string, windowStart: number): Promise<number>;
}
