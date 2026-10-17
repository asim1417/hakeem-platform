// منفذ SQL ضيق لطبقة الخدمة: استعلام بمعاملات مرقّمة ($1..$n) ومعاملة واحدة.
// الإنتاج يمرّره عبر Prisma، والاختبارات المحلية عبر pg؛ فلا تعتمد الخدمة على محرك Prisma.
// القيم تمر معاملاتٍ لا نصًّا مدموجًا، فلا حقن.

export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface EditorialDb extends SqlClient {
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

type PrismaLike = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $transaction<T>(fn: (tx: PrismaTxLike) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T>;
};

type PrismaTxLike = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export function prismaEditorialDb(prisma: PrismaLike): EditorialDb {
  const wrap = (client: PrismaTxLike): SqlClient => ({
    query: async <T>(sql: string, params: readonly unknown[] = []) =>
      (await client.$queryRawUnsafe<T[]>(sql, ...params)) as T[],
  });
  return {
    ...wrap(prisma),
    transaction: (fn) => prisma.$transaction((tx) => fn(wrap(tx)), { timeout: 30_000, maxWait: 10_000 }),
  };
}

/** رمز خطأ Postgres من خطأ pg أو Prisma (P2010 يغلّف رمز القاعدة في meta.code). */
export function pgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { code?: unknown; meta?: { code?: unknown } };
  const isSqlState = (v: unknown): v is string => typeof v === "string" && /^[0-9A-Z]{5}$/.test(v) && !/^P\d{4}$/.test(v);
  // Prisma يضع رمز القاعدة في meta.code ويضع رمزه هو (P2010) في code؛ فيُقدَّم meta.
  if (e.meta && isSqlState(e.meta.code)) return e.meta.code;
  if (isSqlState(e.code)) return e.code;
  const message = String((error as { message?: unknown }).message ?? "");
  const match = message.match(/\b(23505|23514|42501|40001|42P01)\b/);
  return match ? match[1] : null;
}
