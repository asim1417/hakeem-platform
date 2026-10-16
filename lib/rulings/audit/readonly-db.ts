/**
 * readonly-db — اتصال قراءة فقط مشترك لسكربتات فحص الأحكام وجردها.
 *
 * • الرابط من DATABASE_URL_READONLY (يُفضَّل)، وإلا DATABASE_URL.
 * • رابط Neon (*.neon.tech) يُستعلم عبر HTTPS لأن وكيل بيئة التنفيذ لا يمرّر TCP 5432؛
 *   يلزم NODE_USE_ENV_PROXY=1. AUDIT_TRANSPORT=prisma يفرض Prisma (مثل مشغّلات CI).
 * • مع Prisma يُضاف options=-c default_transaction_read_only=on ومهلة ١٢٠ ثانية.
 * • assertReadOnly يوقف التشغيل ما لم يثبت أن الجلسة للقراءة فقط.
 * • لا يُطبع الرابط ولا كلمة المرور في أي رسالة.
 */
import { PrismaClient } from "@prisma/client";
import { neonHttpQuery } from "./neon-http";

export type QueryFn = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;

export interface ReadOnlyDb {
  q: QueryFn;
  transport: "http" | "prisma";
  url: string;
  fromReadonlyVar: boolean;
  close: () => Promise<void>;
}

export function openReadOnlyDb(): ReadOnlyDb {
  const base = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
  if (!base) {
    console.error("لا يوجد DATABASE_URL_READONLY ولا DATABASE_URL — أوقفتُ التشغيل.");
    process.exit(2);
  }
  const u = new URL(base);
  const transport: "http" | "prisma" =
    process.env.AUDIT_TRANSPORT === "prisma" || !/\.neon\.tech$/.test(u.hostname) ? "prisma" : "http";
  if (transport === "prisma" && !u.searchParams.has("options") && process.env.AUDIT_NO_OPTIONS !== "1") {
    u.searchParams.set("options", "-c default_transaction_read_only=on -c statement_timeout=120000");
  }
  const url = u.toString();
  const prisma = transport === "prisma" ? new PrismaClient({ datasources: { db: { url } }, log: ["error"] }) : null;
  const http = transport === "http" ? neonHttpQuery(url) : null;
  const q: QueryFn = (sql, ...params) => (http ? http(sql, ...params) : prisma!.$queryRawUnsafe(sql, ...params));
  return {
    q,
    transport,
    url,
    fromReadonlyVar: Boolean(process.env.DATABASE_URL_READONLY),
    close: async () => {
      await prisma?.$disconnect();
    },
  };
}

/** يوقف التشغيل ما لم يثبت أن الجلسة للقراءة فقط؛ ويرجع وصف الضمان. */
export async function assertReadOnly(db: ReadOnlyDb): Promise<string> {
  const [ro] = await db.q<{ transaction_read_only: string }>("SHOW transaction_read_only");
  if (ro?.transaction_read_only === "on") return "transaction_read_only=on";
  const [p] = await db.q<{ can: boolean }>(
    `SELECT has_table_privilege(current_user, 'judicial_cases', 'UPDATE') AS can`,
  );
  if (db.fromReadonlyVar && p && p.can === false) return "role without UPDATE on judicial_cases";
  console.error("تعذّر إثبات أن الجلسة للقراءة فقط — أوقفتُ التشغيل.");
  process.exit(3);
}
