/**
 * اختبارات مكتب التحرير التشريعي — المرحلة صفر (T0-1 … T0-9).
 *
 * الجزء الأول نقي بلا قاعدة (يعمل في أي مكان).
 * الجزء الثاني يحتاج قاعدة Postgres محلية فارغة للاختبار فقط:
 *   EDITORIAL_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/hakeem_editorial_test
 *   npm i --no-save pg   (لا يُضاف إلى package.json)
 * الحارس يرفض أي مضيف غير محلي، وأي قاعدة لا ينتهي اسمها بـ _test، لأنه يحذفها ويعيد إنشاءها.
 * لا يقرأ DATABASE_URL أبدًا.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveEditorialAccess } from "../lib/modules/editorial/access";
import { sourceRankFromUrl, stableJson } from "../lib/modules/editorial/audit";
import type { EditorialDb, SqlClient } from "../lib/modules/editorial/db";
import {
  bulkApproveAmendmentOps,
  decideAmendmentOp,
  decidePrinciple,
  intakeCounts,
  listAmendmentQueue,
  listPrincipleQueue,
  validateCorrection,
} from "../lib/modules/editorial/intake";
import {
  createChangeSet,
  decideChangeSet,
  publishChangeSet,
  revertChangeSet,
  submitChangeSet,
  validateEvidence,
} from "../lib/modules/editorial/service";
import { EditorialError, type EditorialActor } from "../lib/modules/editorial/types";
import { isEditorialWriteEnabled, READ_ONLY_MESSAGE } from "../lib/modules/editorial/write-gate";
import { PRINCIPLE_REVIEW_STATUS } from "../lib/modules/legal-core/principle-review";

let failed = 0;
let passed = 0;
const ok = (condition: boolean, message: string) => {
  if (condition) {
    passed += 1;
    console.log("✓ " + message);
  } else {
    failed += 1;
    console.error("✗ " + message);
  }
};

async function rejects(fn: () => Promise<unknown>, code: string, message: string): Promise<EditorialError | null> {
  try {
    await fn();
    ok(false, `${message} (لم يُرفض)`);
    return null;
  } catch (error) {
    const matched = error instanceof EditorialError && error.code === code;
    ok(matched, `${message}${matched ? "" : ` — وصل: ${error instanceof Error ? error.message : String(error)}`}`);
    return error instanceof EditorialError ? error : null;
  }
}

const throwsSync = (fn: () => unknown, code: string, message: string) => {
  try {
    fn();
    ok(false, `${message} (لم يُرفض)`);
  } catch (error) {
    ok(error instanceof EditorialError && error.code === code, message);
  }
};

// ── الجزء الأول: نقي ─────────────────────────────────────────────────────────

function pureTests() {
  console.log("\n— نقي —");
  const owner = resolveEditorialAccess("SUPER_ADMIN", []);
  ok(owner.superAdmin && owner.laws && owner.reviewer && owner.qaView && !owner.agent, "SUPER_ADMIN يملك صلاحيات المكتب كلها ولا يُعامل وكيلًا");
  const sysAdmin = resolveEditorialAccess("SYSTEM_ADMIN", []);
  ok(!sysAdmin.laws && !sysAdmin.reviewer && !sysAdmin.qaView, "SYSTEM_ADMIN بلا منح لا يملك شيئًا من المكتب (لا تجاوز كما في canUser)");
  const reviewer = resolveEditorialAccess("LAWYER", ["LEGAL_REVIEWER"]);
  ok(reviewer.reviewer && !reviewer.laws, "المنح الصريح لدور يعطي الصلاحية الممنوحة وحدها");
  const agent = resolveEditorialAccess("TRAINEE", ["LEGAL_AGENT_PROPOSE", "LEGAL_REVIEWER"]);
  ok(agent.agent && !agent.reviewer, "حساب الوكيل لا يعتمد ولو مُنح المعتمِد خطأً");

  ok(sourceRankFromUrl("https://uqn.gov.sa/details?p=1") === 1, "رابط أم القرى رتبة 1");
  ok(sourceRankFromUrl("https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/x") === 2, "رابط هيئة الخبراء رتبة 2");
  ok(sourceRankFromUrl("https://www.moj.gov.sa/x") === 3, "غيرهما رتبة 3");
  ok(stableJson({ b: 1, a: [2, { d: 1, c: 2 }] }) === stableJson({ a: [2, { c: 2, d: 1 }], b: 1 }), "البصمة لا تتأثر بترتيب المفاتيح");

  throwsSync(() => validateEvidence(undefined), "EVIDENCE_REQUIRED", "لا حالة بلا سند");
  throwsSync(() => validateEvidence({ instrument: "م/1", url: "", quote: "نص طويل بما يكفي" }), "EVIDENCE_REQUIRED", "السند بلا رابط يُرفض");
  throwsSync(() => validateEvidence({ instrument: "م/1", url: "http://uqn.gov.sa/x", quote: "نص طويل بما يكفي" }), "EVIDENCE_REQUIRED", "رابط غير https يُرفض");

  throwsSync(() => validateCorrection({}), "INVALID_INPUT", "«موافق مع تصحيح» بلا حقل مصحَّح يُرفض");
  throwsSync(() => validateCorrection({ status: "ساري" }), "INVALID_INPUT", "حقل خارج حقول import_review.py يُرفض");
  ok(validateCorrection({ article_number: "12", new_text: "نص" }).article_number === 12, "تصحيح رقم المادة يُقبل رقمًا");

  ok(PRINCIPLE_REVIEW_STATUS.approve === "reviewed" && PRINCIPLE_REVIEW_STATUS.reject === "rejected", "خريطة قرار المبدأ واحدة للمسارين");
  const routeSource = readFileSync(join(process.cwd(), "app/api/legal-core/principles/[id]/route.ts"), "utf8");
  ok(routeSource.includes("PRINCIPLE_REVIEW_STATUS") && routeSource.includes("recordAudit"), "زر المبدأ القائم يستعمل الخريطة نفسها ويكتب audit_event");

  ok(!isEditorialWriteEnabled({}), "غياب EDITORIAL_DESK_WRITE = قراءة فقط");
  ok(isEditorialWriteEnabled({ EDITORIAL_DESK_WRITE: "1" }), "EDITORIAL_DESK_WRITE=1 يفتح الكتابة");
  ok(READ_ONLY_MESSAGE.includes("للقراءة فقط"), "رسالة القراءة فقط صريحة");
}

// ── الجزء الثاني: قاعدة محلية ────────────────────────────────────────────────

interface PgResult {
  rows: Record<string, unknown>[];
}
interface PgClientLike {
  query(sql: string, params?: readonly unknown[]): Promise<PgResult>;
  release(): void;
}
interface PgPoolLike {
  query(sql: string, params?: readonly unknown[]): Promise<PgResult>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}
interface PgModule {
  Pool: new (config: { connectionString: string; max?: number }) => PgPoolLike;
  Client: new (config: { connectionString: string }) => {
    connect(): Promise<void>;
    query(sql: string): Promise<PgResult>;
    end(): Promise<void>;
  };
}

function pgEditorialDb(pool: PgPoolLike): EditorialDb {
  const wrap = (q: (sql: string, params?: readonly unknown[]) => Promise<PgResult>): SqlClient => ({
    query: async <T>(sql: string, params: readonly unknown[] = []) => (await q(sql, params as unknown[])).rows as T[],
  });
  return {
    ...wrap((sql, params) => pool.query(sql, params)),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(wrap((sql, params) => client.query(sql, params)));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function guardTestUrl(raw: string): URL {
  const url = new URL(raw);
  const host = url.hostname;
  const db = url.pathname.replace(/^\//, "");
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("EDITORIAL_TEST_DATABASE_URL يجب أن يشير إلى مضيف محلي فقط.");
  }
  if (!/_test$/.test(db)) throw new Error("اسم قاعدة الاختبار يجب أن ينتهي بـ _test.");
  return url;
}

const actor = (id: string, role: string, grants: string[] = [], kind: "human" | "agent" = "human"): EditorialActor => ({
  id,
  role,
  kind,
  agentName: kind === "agent" ? id : undefined,
  access: resolveEditorialAccess(role, grants),
});

const EVIDENCE = (n: string) => ({
  instrument: `المرسوم الملكي رقم م/${n}`,
  url: `https://uqn.gov.sa/details?p=${n}`,
  quote: `يُلغى النظام الصادر بالمرسوم الملكي رقم م/${n} ويحل محله النظام الجديد.`,
});

async function dbTests(pg: PgModule, rawUrl: string) {
  const url = guardTestUrl(rawUrl);
  const dbName = url.pathname.replace(/^\//, "");
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: url.toString(), max: 6 });
  const root = process.cwd();
  for (const file of [
    "scripts/editorial/fixtures/base-schema.sql",
    "ingest/uqn-2026-09-25/schema/staging.sql",
    "ingest/uqn-fix-2026-09-25/schema/fix_stage.sql",
    "prisma/migrations/20261017090000_editorial_desk_phase0/migration.sql",
  ]) {
    await pool.query(readFileSync(join(root, file), "utf8"));
  }
  const db = pgEditorialDb(pool);
  const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0] as T;
  const num = async (sql: string, params: unknown[] = []) => Number(Object.values((await pool.query(sql, params)).rows[0])[0]);

  // ── بيانات اختبار اصطناعية ──
  await pool.query(`INSERT INTO users (id, name, email, role) VALUES
    ('u-owner','المالك','owner@test.local','SUPER_ADMIN'),
    ('u-editor','محرر','editor@test.local','SYSTEM_ADMIN'),
    ('u-reviewer','معتمد','reviewer@test.local','LAWYER'),
    ('u-plain-admin','مدير نظام','admin@test.local','SYSTEM_ADMIN')`);
  for (const id of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
    await pool.query(`INSERT INTO legal_systems (id, name) VALUES ($1, $2)`, [id, `نظام اختبار ${id}`]);
  }
  for (const id of ["S1", "S2", "S3", "S5", "S6"]) {
    await pool.query(
      `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_at)
       VALUES ($1, 'work', $2, 'ساري', 'المرسوم الملكي رقم م/1', 'https://uqn.gov.sa/details?p=1', 'يعمل بهذا النظام من تاريخ نشره في الجريدة الرسمية.', 'manual', NOW() - interval '30 days')`,
      [`v-${id}`, id],
    );
  }
  await pool.query(`INSERT INTO legal_articles (id, "legalSystemId", "articleNumber", content, status) VALUES ('a1','S1','1','نص المادة الأولى','ساري')`);
  await pool.query(`INSERT INTO unit_version (id, unit_id, body, valid_from) VALUES ('uv1','a1','نص المادة الأولى', NOW() - interval '1 year')`);
  await pool.query(`INSERT INTO uqn_fix.source_snapshot (url, body, body_sha, retrieved_on) VALUES ('https://uqn.gov.sa/details?p=9', 'نص الأداة', 'sha', CURRENT_DATE)`);
  const op = (id: string, confidence: string, verbatim: boolean | null, risks: string) =>
    pool.query(
      `INSERT INTO uqn_fix.amendment_op (op_id, effect_id, instrument_kind, instrument_no, source_url, target_law_title, target_hakeem_code,
          target_resolution, op_type, article_number, new_text, risks, confidence, verbatim_in_source, evidence_quote, raw)
       VALUES ($1, 'E1', 'royal_decree', 'م/9', 'https://uqn.gov.sa/details?p=9', 'نظام اختبار S1', 'S1', 'hakeem_reference_code',
               'replace_article_text', 1, 'نص جديد', $2::text[], $3, $4, 'تعدل المادة الأولى لتكون بالنص الآتي', '{}'::jsonb)`,
      [id, risks ? [risks] : [], confidence, verbatim],
    );
  await op("OP-A", "rule_exact", true, "");
  await op("OP-B", "rule_exact", true, "");
  await op("OP-C", "needs_review", true, "");
  await op("OP-D", "rule_exact", true, "عقوبة");
  await pool.query(`INSERT INTO judicial_cases (id, title) VALUES ('c1','قضية')`);
  await pool.query(`INSERT INTO judicial_principles (id, title, "principleText", "sourceCaseId", "reviewStatus") VALUES
    ('P1','مبدأ أول','نص المبدأ الأول','c1','needs_review'),
    ('P2','مبدأ ثان','نص المبدأ الثاني','c1','needs_review'),
    ('P3','مبدأ ثالث','نص المبدأ الثالث','c1','reviewed')`);
  await pool.query(`INSERT INTO legal_article_case_links (id, "articleId", "caseId", "relationType") VALUES ('l1','a1','c1','CITES'),('l2','a1','c1','APPLIES')`);

  const owner = actor("u-owner", "SUPER_ADMIN");
  const editor = actor("u-editor", "SYSTEM_ADMIN", ["LEGAL_EDITOR_LAWS", "LEGAL_REVIEWER"]);
  const reviewer = actor("u-reviewer", "LAWYER", ["LEGAL_REVIEWER"]);
  const plainAdmin = actor("u-plain-admin", "SYSTEM_ADMIN");
  const agent = actor("agent-test", "TRAINEE", ["LEGAL_AGENT_PROPOSE"], "agent");

  process.env.EDITORIAL_DESK_WRITE = "1";

  // ── T0-5: غياب بوابة الكتابة ──
  console.log("\n— T0-5 —");
  delete process.env.EDITORIAL_DESK_WRITE;
  const auditBefore5 = await num(`SELECT count(*) FROM audit_event`);
  const e5 = await rejects(
    () => createChangeSet(db, editor, { title: "اختبار", changes: [{ op: "set_work_status", targetId: "S1", status: "ملغى", evidence: EVIDENCE("5") }] }),
    "WRITE_DISABLED",
    "T0-5 إنشاء دفعة بلا EDITORIAL_DESK_WRITE يُرفض",
  );
  ok(Boolean(e5?.message.includes("للقراءة فقط")), "T0-5 الرسالة تقول «اللوحة للقراءة فقط»");
  await rejects(() => decideAmendmentOp(db, reviewer, "OP-A", { decision: "approved" }), "WRITE_DISABLED", "T0-5 قرار عملية تعديل بلا البوابة يُرفض");
  await rejects(() => decidePrinciple(db, reviewer, "P1", { decision: "approve" }), "WRITE_DISABLED", "T0-5 قرار مبدأ بلا البوابة يُرفض");
  ok((await num(`SELECT count(*) FROM change_set`)) === 0 && (await num(`SELECT count(*) FROM audit_event`)) === auditBefore5, "T0-5 لم يُكتب شيء");
  process.env.EDITORIAL_DESK_WRITE = "1";

  // ── T0-6: الطابور يقرأ المصادر ولا يكتب ──
  console.log("\n— T0-6 —");
  const writesBefore6 = await num(`SELECT (SELECT count(*) FROM change_set) + (SELECT count(*) FROM editorial_change) + (SELECT count(*) FROM audit_event)`);
  const q1 = await listAmendmentQueue(db);
  const q2 = await listAmendmentQueue(db);
  const p1 = await listPrincipleQueue(db);
  const counts = await intakeCounts(db);
  ok(q1.total === 4 && q2.total === 4, "T0-6 عمليات التعديل بلا قرار = 4 في المرتين");
  ok(q1.items[0]?.bulk_eligible === true && q1.items.find((i) => i.op_id === "OP-D")?.bulk_eligible === false, "T0-6 أهلية الاعتماد الجماعي تُحسب (OP-D فيها مخاطر)");
  ok(p1.total === 2, "T0-6 المبادئ needs_review = 2");
  ok(counts.amendmentOpsUndecided === 4 && counts.principlesNeedsReview === 2 && counts.caseLinksNeedsReview === 2, "T0-6 عدّادات اللوحة مطابقة");
  ok(counts.unavailable.includes("legal_relations"), "T0-6 الجدول الغائب يظهر «غير متاح» لا خطأ");
  const writesAfter6 = await num(`SELECT (SELECT count(*) FROM change_set) + (SELECT count(*) FROM editorial_change) + (SELECT count(*) FROM audit_event)`);
  ok(writesBefore6 === writesAfter6, "T0-6 فتح الطابور مرتين لا يُنشئ أي صف");

  // ── الإنشاء والفحوص ──
  console.log("\n— الإنشاء والقفل والسند —");
  await rejects(
    () => createChangeSet(db, plainAdmin, { title: "اختبار", changes: [{ op: "set_work_status", targetId: "S1", status: "ملغى", evidence: EVIDENCE("6") }] }),
    "FORBIDDEN",
    "SYSTEM_ADMIN بلا منح لا يُنشئ تغييرًا",
  );
  await rejects(
    () => createChangeSet(db, editor, { title: "بلا سند", changes: [{ op: "set_work_status", targetId: "S1", status: "ملغى", evidence: { instrument: "", url: "", quote: "" } }] }),
    "EVIDENCE_REQUIRED",
    "المبدأ 3: تغيير الحالة بلا سند يُرفض",
  );
  const set1 = await createChangeSet(db, editor, {
    title: "إلغاء نظام اختبار S1",
    changes: [{ op: "set_work_status", targetId: "S1", status: "ملغى", evidence: EVIDENCE("11") }],
  });
  await rejects(
    () => createChangeSet(db, owner, { title: "ثان على S1", changes: [{ op: "set_work_status", targetId: "S1", status: "مستبدل", evidence: EVIDENCE("12") }] }),
    "OPEN_CHANGE_EXISTS",
    "D-03 تغيير ثانٍ على هدف مفتوح يُرفض",
  );
  const sub1 = await submitChangeSet(db, editor, set1.changeSetId);
  ok(sub1.status === "pending", "الفحوص تنجح فتنتقل الدفعة إلى الطابور");

  // ── T0-1: الاعتماد الذاتي ──
  console.log("\n— T0-1 —");
  const deniedBefore = await num(`SELECT count(*) FROM audit_event WHERE action = 'access.denied'`);
  const e1 = await rejects(() => decideChangeSet(db, editor, set1.changeSetId, { decision: "approve" }), "SELF_APPROVAL_FORBIDDEN", "T0-1 المُعِدّ لا يعتمد تغييره");
  ok(e1?.status === 403, "T0-1 الرفض برمز 403");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'access.denied'`)) === deniedBefore + 1, "T0-1 الرفض مسجّل في audit_event");
  const set2 = await createChangeSet(db, owner, {
    title: "المالك يعدّل S2",
    changes: [{ op: "set_work_status", targetId: "S2", status: "ملغى", evidence: EVIDENCE("21") }],
  });
  await submitChangeSet(db, owner, set2.changeSetId);
  await rejects(() => decideChangeSet(db, owner, set2.changeSetId, { decision: "approve" }), "REASON_REQUIRED", "T0-1 اعتماد SUPER_ADMIN الذاتي بلا سبب يُرفض");
  const d2 = await decideChangeSet(db, owner, set2.changeSetId, { decision: "approve", reason: "اختبار الاعتماد الذاتي المسبّب" });
  ok(d2.selfApproval === true && d2.status === "approved", "T0-1 اعتماد SUPER_ADMIN الذاتي بسبب يُقبل");
  ok((await one<{ self_approval: boolean }>(`SELECT self_approval FROM review_decision WHERE id = $1`, [d2.decisionId])).self_approval === true, "T0-1 القرار موسوم self_approval");
  const d1 = await decideChangeSet(db, reviewer, set1.changeSetId, { decision: "approve" });
  ok(d1.status === "approved" && d1.selfApproval === false, "معتمِد آخر يعتمد دفعة المحرر");

  // ── T0-2: السجل لا يُعدَّل ولا يُحذف ──
  console.log("\n— T0-2 —");
  const tryWrite = async (sql: string) => {
    try {
      await pool.query(sql);
      return false;
    } catch {
      return true;
    }
  };
  ok(await tryWrite(`UPDATE audit_event SET action = 'x'`), "T0-2 UPDATE على audit_event مرفوض من القاعدة");
  ok(await tryWrite(`DELETE FROM audit_event`), "T0-2 DELETE على audit_event مرفوض من القاعدة");
  ok(await tryWrite(`TRUNCATE audit_event`), "T0-2 TRUNCATE على audit_event مرفوض من القاعدة");
  ok(await tryWrite(`UPDATE review_decision SET reason = 'x'`), "قرار الاعتماد لا يُعدَّل");
  ok(await tryWrite(`UPDATE editorial_change SET after = '{}'::jsonb`), "محتوى التغيير ثابت بعد إنشائه");
  ok(await tryWrite(`DELETE FROM editorial_change`), "التغيير لا يُحذف");
  ok(await tryWrite(`DELETE FROM change_set`), "الدفعة لا تُحذف");

  // ── T0-3: النشر الذري ──
  console.log("\n— T0-3 —");
  const set3 = await createChangeSet(db, editor, {
    title: "ثلاثة تغييرات",
    changes: [
      { op: "set_work_status", targetId: "S3", status: "ملغى", evidence: EVIDENCE("31") },
      { op: "set_work_status", targetId: "S5", status: "ملغى", evidence: EVIDENCE("32") },
      { op: "set_work_status", targetId: "S6", status: "مستبدل", evidence: EVIDENCE("33") },
    ],
  });
  await submitChangeSet(db, editor, set3.changeSetId);
  await decideChangeSet(db, reviewer, set3.changeSetId, { decision: "approve" });
  // سجل أحدث لـ S5 من عملية أخرى بعد الاعتماد
  await pool.query(
    `INSERT INTO verification (id, object_type, object_id, verified_status, method) VALUES ('v-S5-external', 'work', 'S5', 'ساري', 'rule')`,
  );
  const verBefore3 = await num(`SELECT count(*) FROM verification`);
  await rejects(() => publishChangeSet(db, reviewer, set3.changeSetId), "CONFLICT", "T0-3 تعارض في تغيير واحد يوقف النشر");
  ok((await num(`SELECT count(*) FROM verification`)) === verBefore3, "T0-3 لم يُكتب أي صف سند (ولا لـ S3 وS6)");
  ok((await one<{ status: string }>(`SELECT status FROM change_set WHERE id = $1`, [set3.changeSetId])).status === "approved", "T0-3 الدفعة بقيت معتمدة غير منشورة");
  ok((await num(`SELECT count(*) FROM index_sync WHERE change_set_id = $1`, [set3.changeSetId])) === 0, "T0-3 لا مزامنة فهارس لما لم يُنشر");

  // ── T0-4: نشر ثم تراجع ──
  console.log("\n— T0-4 —");
  const hashS2 = async () => (await one<{ h: string }>(`SELECT md5(string_agg(t::text, '|' ORDER BY id)) AS h FROM verification t WHERE object_id = 'S2' AND id = 'v-S2'`)).h;
  const originalHash = await hashS2();
  const pub2 = await publishChangeSet(db, reviewer, set2.changeSetId);
  ok(pub2.published === 1, "T0-4 النشر يكتب صف سند جديدًا");
  const latestS2 = await one<{ verified_status: string; supersedes_verification_id: string }>(
    `SELECT verified_status, supersedes_verification_id FROM verification WHERE object_id = 'S2' ORDER BY verified_at DESC, id DESC LIMIT 1`,
  );
  ok(latestS2.verified_status === "ملغى" && latestS2.supersedes_verification_id === "v-S2", "T0-4 الحالة المشتقة = آخر صف، ويشير إلى السابق");
  ok((await num(`SELECT count(*) FROM index_sync WHERE change_set_id = $1`, [set2.changeSetId])) === 1, "S-01 النشر يضيف صف index_sync");
  const rev = await revertChangeSet(db, reviewer, set2.changeSetId, { reason: "اختبار التراجع" });
  ok(rev.status === "draft", "T0-4 التراجع ينشئ دفعة معاكسة تمر بالدورة");
  await submitChangeSet(db, reviewer, rev.revertChangeSetId);
  await decideChangeSet(db, owner, rev.revertChangeSetId, { decision: "approve" });
  await publishChangeSet(db, owner, rev.revertChangeSetId);
  const afterRevert = await one<{ verified_status: string }>(
    `SELECT verified_status FROM verification WHERE object_id = 'S2' ORDER BY verified_at DESC, id DESC LIMIT 1`,
  );
  ok(afterRevert.verified_status === "ساري", "T0-4 بعد التراجع تعود الحالة السابقة بصف معاكس جديد");
  ok((await hashS2()) === originalHash, "T0-4 صف السند الأصلي لم يتغير (البصمة نفسها)");
  ok((await num(`SELECT count(*) FROM verification WHERE object_id = 'S2'`)) === 3, "T0-4 لا حذف: الأصل + النشر + المعاكس");
  ok((await one<{ status: string }>(`SELECT status FROM change_set WHERE id = $1`, [set2.changeSetId])).status === "reverted", "T0-4 الدفعة الأصلية موسومة «متراجع عنها»");
  ok(
    (await num(`SELECT count(*) FROM audit_event WHERE action IN ('change_set.publish','change_set.revert_requested') AND (object_id = $1 OR detail->>'reverts' = $1)`, [set2.changeSetId])) >= 2,
    "T0-4 حدثان على الأقل في السجل (النشر والتراجع)",
  );
  // تراجع عاجل للمالك
  await publishChangeSet(db, reviewer, set1.changeSetId);
  await rejects(() => revertChangeSet(db, reviewer, set1.changeSetId, { reason: "عاجل", emergency: true }), "FORBIDDEN", "W-05 التراجع العاجل للمالك وحده");
  const emergency = await revertChangeSet(db, owner, set1.changeSetId, { reason: "خطأ ظاهر في السند", emergency: true });
  ok(emergency.status === "published", "W-05 التراجع العاجل بخطوة واحدة يُنشر فورًا");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'change_set.emergency_revert' AND object_id = $1`, [set1.changeSetId])) === 1, "W-05 التراجع العاجل مسجّل");
  const set4 = await createChangeSet(db, editor, {
    title: "نظام بلا حالة سابقة",
    changes: [{ op: "set_work_status", targetId: "S4", status: "ساري", evidence: EVIDENCE("41") }],
  });
  await submitChangeSet(db, editor, set4.changeSetId);
  await decideChangeSet(db, reviewer, set4.changeSetId, { decision: "approve" });
  await publishChangeSet(db, reviewer, set4.changeSetId);
  await rejects(() => revertChangeSet(db, reviewer, set4.changeSetId, { reason: "اختبار" }), "NO_PRIOR_STATUS", "التراجع لا يخترع حالة بلا سند سابق");

  // ── T0-7: اعتماد عملية تعديل ──
  console.log("\n— T0-7 —");
  const contentHash = async () =>
    (await one<{ h: string }>(
      `SELECT md5(coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM legal_articles t),'') || '#' ||
                  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM unit_version t),'') || '#' ||
                  coalesce((SELECT string_agg(t::text,'|' ORDER BY id) FROM verification t),'')) AS h`,
    )).h;
  const beforeContent = await contentHash();
  const reviewsBefore = await num(`SELECT count(*) FROM uqn_fix.amendment_review`);
  const r7 = await decideAmendmentOp(db, reviewer, "OP-C", { decision: "approved", note: "مطابق للأداة" });
  ok((await num(`SELECT count(*) FROM uqn_fix.amendment_review`)) === reviewsBefore + 1, "T0-7 صف واحد جديد في uqn_fix.amendment_review");
  ok((await one<{ decision: string; reviewer: string }>(`SELECT decision, reviewer FROM uqn_fix.amendment_decision WHERE op_id = 'OP-C'`)).decision === "approved", "T0-7 amendment_decision يعكس القرار");
  ok((await num(`SELECT count(*) FROM review_decision WHERE change_set_id = $1`, [r7.changeSetId])) === 1, "T0-7 ومعه review_decision");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'intake.amendment.decide' AND object_id = 'OP-C'`)) === 1, "T0-7 ومعه audit_event");
  ok((await num(`SELECT count(*) FROM editorial_change WHERE change_set_id = $1 AND author_kind = 'agent' AND author_agent = 'uqn-fix'`, [r7.changeSetId])) === 1, "T0-7 المُعِدّ هو الوكيل والمعتمِد بشري");
  ok((await contentHash()) === beforeContent, "T0-7 بصمات legal_articles وunit_version وverification لم تتغير");
  ok((await listAmendmentQueue(db)).total === 3, "T0-7 العملية خرجت من الطابور");

  // ── T0-8: التصحيح والتزامن والاعتماد الجماعي ──
  console.log("\n— T0-8 —");
  await rejects(() => decideAmendmentOp(db, reviewer, "OP-B", { decision: "approved_with_edit" }), "INVALID_INPUT", "T0-8 «موافق مع تصحيح» بلا حقل مصحَّح يُرفض");
  await rejects(() => decideAmendmentOp(db, reviewer, "OP-B", { decision: "rejected" }), "REASON_REQUIRED", "رفض عملية بلا سبب يُرفض");
  const results = await Promise.allSettled([
    decideAmendmentOp(db, reviewer, "OP-B", { decision: "approved" }),
    decideAmendmentOp(db, owner, "OP-B", { decision: "approved" }),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const already = results.filter((r) => r.status === "rejected" && r.reason instanceof EditorialError && r.reason.code === "ALREADY_DECIDED").length;
  ok(fulfilled === 1 && already === 1, "T0-8 نقرتا اعتماد متزامنتان تنتجان قرارًا واحدًا");
  ok((await num(`SELECT count(*) FROM uqn_fix.amendment_review WHERE op_id = 'OP-B'`)) === 1, "T0-8 صف قرار واحد لـ OP-B");
  const reviewsBeforeBulk = await num(`SELECT count(*) FROM uqn_fix.amendment_review`);
  await rejects(() => bulkApproveAmendmentOps(db, reviewer, ["OP-A", "OP-D"]), "NOT_ELIGIBLE", "الاعتماد الجماعي يرفض عملية فيها مخاطر");
  ok((await num(`SELECT count(*) FROM uqn_fix.amendment_review`)) === reviewsBeforeBulk, "الرفض الجماعي لم يكتب شيئًا");
  const bulk = await bulkApproveAmendmentOps(db, reviewer, ["OP-A"], "اعتماد جماعي اختباري");
  ok(bulk.approved === 1 && (await num(`SELECT count(*) FROM uqn_fix.amendment_review WHERE op_id = 'OP-A'`)) === 1, "الاعتماد الجماعي: صف قرار مستقل لكل عملية");
  const withEdit = await decideAmendmentOp(db, reviewer, "OP-D", { decision: "approved_with_edit", corrected: { article_number: 2 }, note: "تصحيح رقم المادة" });
  ok(Boolean(withEdit.changeSetId), "«موافق مع تصحيح» بحقل صحيح يُقبل");
  ok(
    (await one<{ corrected: { article_number: number } }>(`SELECT corrected FROM uqn_fix.amendment_decision WHERE op_id = 'OP-D'`)).corrected.article_number === 2,
    "التصحيح محفوظ في corrected",
  );

  // ── T0-9: المبادئ والوكيل ──
  console.log("\n— T0-9 —");
  const pr = await decidePrinciple(db, reviewer, "P1", { decision: "approve" });
  ok(pr.reviewStatus === PRINCIPLE_REVIEW_STATUS.approve, "T0-9 اعتماد مبدأ من الطابور = النتيجة نفسها في reviewStatus");
  ok((await one<{ reviewStatus: string }>(`SELECT "reviewStatus" FROM judicial_principles WHERE id = 'P1'`)).reviewStatus === "reviewed", "T0-9 الحالة محفوظة");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'intake.principle.decide' AND object_id = 'P1'`)) === 1, "T0-9 audit_event للطابور");
  ok(
    (await one<{ before: { reviewStatus: string } }>(`SELECT before FROM editorial_change WHERE target_id = 'P1'`)).before.reviewStatus === "needs_review",
    "القيمة السابقة محفوظة في editorial_change.before",
  );
  await rejects(() => decidePrinciple(db, reviewer, "P3", { decision: "approve" }), "ALREADY_DECIDED", "المبدأ المراجَع لا يُعاد قراره من الطابور");
  const deniedBefore9 = await num(`SELECT count(*) FROM audit_event WHERE action = 'access.denied'`);
  const e9 = await rejects(() => decidePrinciple(db, agent, "P2", { decision: "approve" }), "AGENT_CANNOT_DECIDE", "T0-9 حساب LEGAL_AGENT_PROPOSE لا يعتمد مبدأ");
  ok(e9?.status === 403, "T0-9 برمز 403");
  await rejects(() => decideAmendmentOp(db, agent, "OP-X", { decision: "approved" }), "AGENT_CANNOT_DECIDE", "حساب الوكيل لا يعتمد عملية تعديل");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'access.denied'`)) === deniedBefore9 + 2, "رفض الوكيل مسجّل في السجل");
  const agentSet = await createChangeSet(db, agent, {
    title: "اقتراح وكيل",
    changes: [{ op: "set_work_status", targetId: "S6", status: "مستبدل", evidence: EVIDENCE("61") }],
  }).catch((error) => error);
  ok(
    agentSet instanceof EditorialError && agentSet.code === "OPEN_CHANGE_EXISTS",
    "الوكيل يقترح، والقفل يمنعه على هدف مفتوح (S6 في دفعة T0-3)",
  );
  const agentSet2 = await createChangeSet(db, agent, {
    title: "اقتراح وكيل على S5",
    changes: [{ op: "set_work_status", targetId: "S5", status: "مستبدل", evidence: EVIDENCE("62") }],
  }).catch((error) => error);
  ok(agentSet2 instanceof EditorialError && agentSet2.code === "OPEN_CHANGE_EXISTS", "قفل الهدف يشمل S5 أيضًا");
  const agentSet3 = await createChangeSet(db, agent, {
    title: "اقتراح وكيل على S4",
    changes: [{ op: "set_work_status", targetId: "S4", status: "ملغى", evidence: EVIDENCE("63") }],
  });
  ok((await one<{ author_kind: string }>(`SELECT author_kind FROM change_set WHERE id = $1`, [agentSet3.changeSetId])).author_kind === "agent", "الوكيل يُنشئ مسودة باسمه");
  await submitChangeSet(db, agent, agentSet3.changeSetId);
  await rejects(() => decideChangeSet(db, agent, agentSet3.changeSetId, { decision: "approve" }), "AGENT_CANNOT_DECIDE", "T1-9 الوكيل لا يعتمد دفعة");
  await rejects(() => publishChangeSet(db, agent, agentSet3.changeSetId), "AGENT_CANNOT_DECIDE", "الوكيل لا ينشر");

  await pool.end();
}

async function main() {
  pureTests();
  const url = process.env.EDITORIAL_TEST_DATABASE_URL;
  if (!url) {
    console.log("\n(تخطّي اختبارات القاعدة: EDITORIAL_TEST_DATABASE_URL غير مضبوط — قاعدة محلية للاختبار فقط)");
  } else {
    const moduleName = "pg";
    const pg = (await import(moduleName)) as { default?: PgModule } & PgModule;
    await dbTests(pg.default ?? pg, url);
  }
  console.log(`\n${passed} ناجح، ${failed} فاشل`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
