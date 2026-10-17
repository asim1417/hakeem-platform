/**
 * HKM-023-B: اتصال اختبار محلي فقط. يرفض أي قاعدة ليست على 127.0.0.1/localhost أو لا ينتهي اسمها بـ _test،
 * فلا يمكن أن يلمس قاعدة الإنتاج ولا فرعًا منها ولو مُرّر رابطها خطأً. لا يقرأ DATABASE_URL أبدًا.
 * pg يُحمَّل ديناميكيًا بنوع محلي ضيق (على نمط اختبارات مكتب التحرير)، فلا تبعية ولا @types جديدة.
 */
import type { SqlClient } from "../../lib/modules/legal-core/sql-port";

export const DEFAULT_LOCAL_TEST_URL = "postgres://hakeem:localtest@127.0.0.1:54329/hakeem_hkm023b_test";

export interface PgClientLike {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}
type PgModule = { Client: new (cfg: { connectionString: string }) => PgClientLike };

export async function loadPg(): Promise<PgModule> {
  const moduleName = "pg";
  const pg = (await import(moduleName)) as { default?: PgModule } & PgModule;
  return pg.default ?? pg;
}

export function assertLocalTestUrl(url: string): void {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, "");
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname) || !db.endsWith("_test")) {
    throw new Error(`مرفوض: الاختبار يعمل على قاعدة محلية اسمها ينتهي بـ _test فقط (المُعطى: ${u.hostname}/${db})`);
  }
}

/** عميل pg واحد: الاستعلامات تُسلسل (Promise.all في الكود لا يرسلها متزامنة على الاتصال نفسه). */
export function sqlClientOf(client: PgClientLike): SqlClient {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    query: <T>(sql: string, params: readonly unknown[] = []) => {
      const run = chain.then(() => client.query(sql, [...params])).then((r) => r.rows as T[]);
      chain = run.catch(() => undefined);
      return run;
    },
  };
}

export async function connectLocalTest(url = process.env.HKM023B_TEST_DATABASE_URL || DEFAULT_LOCAL_TEST_URL): Promise<{ client: PgClientLike; db: SqlClient } | null> {
  assertLocalTestUrl(url);
  const { Client } = await loadPg();
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    // منطقة UTC كقاعدة Neon، فلا تعتمد النتائج على منطقة الجهاز.
    await client.query("SET TIME ZONE 'UTC'");
  } catch (e) {
    console.log(`(تخطٍّ) لا قاعدة محلية على ${new URL(url).host}: ${(e as Error).message}`);
    return null;
  }
  return { client, db: sqlClientOf(client) };
}
