/**
 * منفذ SQL ضيق (على نمط lib/modules/editorial/db.ts في فرع مكتب التحرير): استعلام بمعاملات مرقّمة ($1..$n).
 * الإنتاج يمرّره عبر Prisma ($queryRawUnsafe)، والاختبارات المحلية عبر pg؛ فلا تعتمد دوال القراءة
 * على محرك Prisma. القيم معاملات لا نص مدموج، فلا حقن.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

type PrismaLike = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export function prismaSqlClient(prisma: PrismaLike): SqlClient {
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => (await prisma.$queryRawUnsafe<T[]>(sql, ...params)) as T[],
  };
}

/** رمز خطأ Postgres من خطأ pg أو Prisma (P2010 يغلّف رمز القاعدة في meta.code). */
export function pgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { code?: unknown; meta?: { code?: unknown } };
  const isSqlState = (v: unknown): v is string => typeof v === "string" && /^[0-9A-Z]{5}$/.test(v) && !/^P\d{4}$/.test(v);
  if (e.meta && isSqlState(e.meta.code)) return e.meta.code;
  if (isSqlState(e.code)) return e.code;
  const message = String((error as { message?: unknown }).message ?? "");
  const match = message.match(/\b(42P01|42703)\b/);
  return match ? match[1] : null;
}

/** جدول أو عمود غير موجود = بيانات غير مطبّقة بعد (سقوط آمن). */
export function isMissingRelation(error: unknown): boolean {
  const code = pgErrorCode(error);
  if (code === "42P01" || code === "42703") return true;
  return /does not exist/.test(String((error as { message?: unknown })?.message ?? ""));
}
