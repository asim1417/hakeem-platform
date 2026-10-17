/**
 * اختبارات خدمة العدّ الموحدة وعلل لوحة المحتوى القانوني — HKM-023-A، المرحلة م١.
 * كل اختبار مسمّى برمز متطلبه في الأمر الموجّه (L0-1، L0-2، L0-4، L5-6، L3-4، L12-10) أو علته (E-1 … E-6).
 *
 * الجزء الأول نقي بلا قاعدة (يعمل في أي مكان): التعريفات، والعرض، وفحص مصدر الصفحات، والقائمة، والأدوار.
 * الجزء الثاني يحتاج قاعدة Postgres محلية فارغة للاختبار فقط، ببيانات اصطناعية بأعمدة الإنتاج:
 *   LEGAL_METRICS_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/hakeem_legal_metrics_test
 *   (pg موجود في node_modules؛ لا يُضاف إلى package.json)
 * الحارس يرفض أي مضيف غير محلي، وأي قاعدة لا ينتهي اسمها بـ _test، لأنه يحذفها ويعيد إنشاءها.
 * لا يقرأ DATABASE_URL أبدًا. الخدمة نفسها تُشغَّل على اتصال READ ONLY.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { ADMIN_NAV_SECTIONS, activeAdminHref } from "../components/admin/AdminNav";
import { summaryFromMetrics } from "../lib/modules/legal-core/intelligence";
import {
  DESK_QUEUE_OVERRIDES,
  formatMetricValue,
  inContext,
  JUDGMENTS_QUEUE,
  listPrinciples,
  loadLegalMetrics,
  metric,
  METRIC_DEFINITIONS,
  METRIC_IDS,
  METRIC_SQL_STATEMENTS,
  metricNumber,
  principleCourts,
  principleQueueHref,
  PRINCIPLE_STATUS_ALL,
  SYSTEMS_QUEUE,
  ISSUES_PAGE,
  type LegalIssuesCounts,
  type LegalMetricsSnapshot,
  type MetricGroup,
  type MetricId,
  type MetricsSql,
} from "../lib/modules/legal-core/metrics";
import { showsPointsDownload } from "../lib/modules/legal-core/ruling-display";
import { ISSUANCE_UNAVAILABLE, STATUS_UNVERIFIED_SHORT, systemCardDateLine, systemCardStatus } from "../lib/modules/legal-core/system-card";
import { UNVERIFIED_NOTICE } from "../lib/modules/legal-core/verified-status";

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

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// ── الجزء الأول: نقي ─────────────────────────────────────────────────────────

/** صفحات فيها عدّادات قانونية: كلها تقرأ legalMetricsService ولا تعدّ بنفسها. */
const COUNTER_PAGES = [
  "app/dashboard/legal-core/quality/page.tsx",
  "app/dashboard/legal-core/citations/dashboard/page.tsx",
  "app/dashboard/legal-core/admin/page.tsx",
  "app/dashboard/legal-core/principles/page.tsx",
  "app/dashboard/legal-core/page.tsx",
  "app/dashboard/legal-core/legal-issues/page.tsx",
];

function pureTests() {
  console.log("\n— نقي —");

  // L0-1: التعريف المكتوب الواحد لكل مقياس.
  ok(METRIC_IDS.length >= 30, `L0-1 سجل التعريفات يغطي ${METRIC_IDS.length} مقياسًا`);
  ok(
    METRIC_IDS.every((id) => METRIC_DEFINITIONS[id].definition.trim().length > 10 && METRIC_DEFINITIONS[id].label.trim().length > 2),
    "L0-1 لكل مقياس تسمية وتعريف مكتوب",
  );
  ok(
    METRIC_IDS.every((id) => {
      const d = METRIC_DEFINITIONS[id];
      return d.queue !== null || ("queueNote" in d && typeof d.queueNote === "string" && d.queueNote.length > 5);
    }),
    "L0-2 كل مقياس بلا طابور يذكر سبب غيابه ومرحلة بنائه",
  );
  ok(
    METRIC_DEFINITIONS["judgments.unlinked"].definition.includes("بأي حالة مراجعة"),
    "E-1 تعريف «حكم بلا رابط» مكتوب: لا رابط بأي حالة مراجعة",
  );
  ok(METRIC_SQL_STATEMENTS.every((s) => /^\s*(SELECT|WITH)\b/i.test(s)), "L0-1 كل عبارات الخدمة قراءة (SELECT/WITH)");

  // L0-1: كل صفحة عدّادات تقرأ من الخدمة، ولا عدّ محلي ولا قيمة ثابتة.
  for (const rel of COUNTER_PAGES) {
    const src = read(rel);
    ok(src.includes("@/lib/modules/legal-core/metrics-server") && /getLegalMetrics(Cached)?\(/.test(src), `L0-1 every counter reads legalMetricsService — ${rel}`);
    ok(!/prisma\.\w+\.(count|groupBy)\(/.test(src) && !src.includes("$queryRaw"), `L0-1 لا عدّ محلي عبر Prisma — ${rel}`);
    ok(!/value=\{0\}/.test(src), `L0-1 لا عدّاد ثابت صفرًا — ${rel}`);
  }
  const judgmentsList = read("app/dashboard/legal-core/judgments/page.tsx");
  ok(!judgmentsList.includes("legalArticleCaseLink.count") && judgmentsList.includes('metric(linkMetrics, "citations.total")'), "L0-1 عدّاد الروابط في قائمة الأحكام من الخدمة");
  const panel = read("components/legal-core/LegalMetricsPanel.tsx");
  ok(panel.includes("getLegalMetrics(") && !/prisma/.test(panel), "L0-1 LegalMetricsPanel يقرأ الخدمة وحدها");
  ok(!read("app/dashboard/legal-core/quality/page.tsx").includes("أحكام غير مربوطة"), "E-1 العدّاد الثابت «أحكام غير مربوطة = ٠» أُزيل من /quality");

  // مراجعة الجودة ع١: مركز التشغيل الذكي في الصفحة الرئيسية يقرأ الخدمة نفسها (لا رقمان لـ«تحتاج مراجعة»).
  const intelligence = read("lib/modules/legal-core/intelligence.ts");
  const summaryFn = intelligence.slice(intelligence.indexOf("export function summaryFromMetrics"), intelligence.indexOf("// ───────────────────────── أزرار التشغيل الذكي"));
  ok(summaryFn.includes("getLegalMetricsCached") && !/prisma\.\w+\.(count|groupBy)\(/.test(summaryFn), "L0-1 every counter reads legalMetricsService — مركز التشغيل الذكي (intelligence.ts)");
  ok(read("app/dashboard/legal-core/page.tsx").includes("<CoreIntelligenceDashboard"), "L0-1 الصفحة الرئيسية تضم الويدجت؛ وأعداده من الخدمة (السطر السابق)");
  // مراجعة الجودة ع٢: /admin/legal — رقم واحد لكل عدّاد وطابور واحد له.
  const deskPage = read("app/admin/legal/page.tsx");
  ok(deskPage.includes('<LegalMetricsPanel context="desk" />'), "L0-1 every counter reads legalMetricsService — /admin/legal (اللوحة بسياق المكتب)");
  const deskCounters = read("components/editorial/DeskCounters.tsx");
  ok(!deskCounters.includes("principlesNeedsReview") && !deskCounters.includes("caseLinksNeedsReview"), "L0-1 /admin/legal لا يعرض المبادئ والروابط المنتظرة مرتين");
  const intake = read("lib/modules/editorial/intake.ts");
  const intakeCountsSrc = intake.slice(intake.indexOf("export async function intakeCounts"), intake.indexOf("// ── التحقق من المدخلات"));
  ok(intakeCountsSrc.includes("loadLegalMetrics(") && !/FROM judicial_principles|FROM legal_article_case_links/.test(intakeCountsSrc), "L0-1 intakeCounts يأخذ المبادئ والروابط المنتظرة من الخدمة");
  ok(DESK_QUEUE_OVERRIDES["principles.pending"]?.href === "/admin/legal/queue?tab=principles", "L0-2 في المكتب: «مبادئ بانتظار المراجعة» يفتح طابور المكتب لا الاعتماد المباشر");
  // الأداء (م-٢): الصفحات العامة تقرأ لقطة مخزنة.
  for (const rel of ["app/dashboard/legal-core/page.tsx", "app/dashboard/legal-core/legal-issues/page.tsx", "app/dashboard/legal-core/judgments/page.tsx"]) {
    ok(read(rel).includes("getLegalMetricsCached("), `M-2 الصفحة العامة تقرأ اللقطة المخزنة — ${rel}`);
  }
  ok(read("lib/modules/legal-core/metrics-server.ts").includes("tags: [LEGAL_CORE_CACHE_TAG]"), "M-2 التخزين بوسم النواة نفسه (يُبطَل مع بقية أعدادها)");
  // الشروح (م-١): لا تُقرأ ملاحظات المستخدمين.
  ok(METRIC_SQL_STATEMENTS.every((t) => !/annotations/.test(t)), "M-1 الخدمة لا تقرأ annotations (ملاحظات المستخدمين الخاصة)");

  // حارس شامل للمستودع (مراجعة الجودة، بند الخطة ٩): لا عدّ للجداول القانونية خارج الخدمة إلا باستثناء مكتوب.
  const COUNT_RE = /prisma\.(legalArticle|judicialCase|legalArticleCaseLink|judicialPrinciple|legalSystem|legalRelation)\.(count|groupBy)\(/;
  const ALLOWED: Record<string, string> = {
    "app/dashboard/legal-core/judgments/page.tsx": "عدد صفوف الطابور المصفّى نفسه (لا عدّاد)",
    "lib/modules/library/library-service.ts": "إجمالي قائمة البحث والأنظمة المصفّاة؛ ودوال العدّ المخزنة القديمة لا يستعملها أحد بعد م١",
    "lib/modules/legal-core/authority.ts": "وزن سلطة المادة في الترتيب (لكل مادة)",
    "lib/modules/legal-core/legal-retrieval.ts": "إجمالي نتائج بحث مصفّى",
    "lib/modules/legal-search/providers/knowledge-graph-provider.ts": "فحص توفر مزود البحث",
    "lib/modules/knowledge-graph/embeddings.ts": "تغطية المتجهات (م٧ ل١٠-٣ ينقلها إلى الخدمة)",
    "lib/modules/observability/health-index.ts": "مؤشر الصحة التشغيلي",
    "app/admin/page.tsx": "إجماليات لوحة المنصة (ن-٣: تنتقل إلى الخدمة لاحقًا)",
    "app/dashboard/page.tsx": "إجمالي المواد في لوحة المستخدم (ن-٣)",
    "lib/modules/admin/platform-overview.ts": "إجماليات نظرة المنصة (ن-٣)",
  };
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name) && COUNT_RE.test(read(rel))) found.push(rel);
    }
  };
  ["app", "components", "lib"].forEach(walk);
  const unexpectedCounters = found.filter((f) => !ALLOWED[f]);
  ok(unexpectedCounters.length === 0, `L0-1 لا عدّ للجداول القانونية خارج legalMetricsService إلا باستثناء مكتوب${unexpectedCounters.length ? ` — ${unexpectedCounters.join("، ")}` : ""}`);
  const users: string[] = [];
  const scan = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) scan(rel);
      else if (/\.(ts|tsx)$/.test(name) && rel !== "lib/modules/library/library-service.ts" && /countArticlesNeedingReview|countJudicialCases|getClassificationCount/.test(read(rel))) users.push(rel);
    }
  };
  ["app", "components", "lib"].forEach(scan);
  ok(users.length === 0, `L0-1 لا أحد يستعمل دوال العدّ المخزنة القديمة (تعريف ثانٍ لـ«تحتاج مراجعة»)${users.length ? ` — ${users.join("، ")}` : ""}`);

  // L0-2: طوابير العدّادات التي لها صفحة قائمة.
  ok(METRIC_DEFINITIONS["judgments.unlinked"].queue?.href === `${JUDGMENTS_QUEUE}?links=none`, "L0-2 «أحكام بلا رابط» يفتح قائمة الأحكام بمرشح links=none");
  ok(METRIC_DEFINITIONS["judgments.linked"].queue?.href === `${JUDGMENTS_QUEUE}?links=any`, "L0-2 «أحكام مرتبطة» يفتح قائمة الأحكام بمرشح links=any");
  ok(
    judgmentsList.includes('links === "none" ? { articleLinks: { none: {} } } : links === "any" ? { articleLinks: { some: {} } }'),
    "L0-2 قائمة الأحكام تترجم links=none/any إلى مرشح العلاقة نفسه",
  );
  ok(METRIC_DEFINITIONS["principles.total"].queue?.href === principleQueueHref(PRINCIPLE_STATUS_ALL), "L0-2 إجمالي المبادئ يفتح «كل الحالات»");
  const principlesPage = read("app/dashboard/legal-core/principles/page.tsx");
  ok(principlesPage.includes("getPrincipleQueue(") && !principlesPage.includes("findMany"), "L0-2 قائمة المبادئ تقرأ من الخدمة نفسها (لا findMany منفصل)");

  // L0-4: العرض.
  ok(formatMetricValue({ kind: "not_applicable", reason: "x" }) === "لا ينطبق", "L0-4 not-applicable يُعرض «لا ينطبق»");
  ok(formatMetricValue({ kind: "unavailable", reason: "x" }) === "غير متاح", "L0-4 المصدر المتعذّر يُعرض «غير متاح»");
  ok(metricNumber({ kind: "unavailable", reason: "x" }) === null && metricNumber({ kind: "not_applicable", reason: "x" }) === null, "L0-4 لا إسقاط إلى صفر");
  ok(formatMetricValue({ kind: "count", value: 39636 }) === (39636).toLocaleString("ar-SA"), "L0-1 العدد يُعرض بالأرقام العربية");

  // L5-6: مرشح المبادئ.
  ok(principlesPage.includes("PRINCIPLE_STATUS_ALL") && principlesPage.includes("byStatus.rows.map"), "L5-6 مرشح المبادئ يعرض «كل الحالات» وكل حالة بعددها");

  // L3-4 / E-4: زر النقاط.
  ok(!showsPointsDownload("SUPER_ADMIN"), "L3-4 زر «تحميل بالنقاط» لا يظهر للسوبر أدمن");
  ok(!showsPointsDownload("SYSTEM_ADMIN"), "L3-4 ولا لمدير النظام (الأدمن)");
  ok(["LAWYER", "JUDGE", "TRAINER", "TRAINEE"].every((r) => showsPointsDownload(r)), "L3-4 ويبقى للمشتركين (محامٍ، قاضٍ، مدرّب، متدرّب)");
  const judgmentPage = read("app/dashboard/legal-core/judgments/[id]/page.tsx");
  ok(/showsPointsDownload\(user\.role\) \? <SpendCreditsButton/.test(judgmentPage), "L3-4 صفحة الحكم تشترط الدور قبل عرض الزر");

  // E-5: بطاقة النظام.
  ok(systemCardDateLine({}) === ISSUANCE_UNAVAILABLE && ISSUANCE_UNAVAILABLE.includes("غير متوفر"), "E-5 بلا تاريخ: «غير متوفر» صراحةً");
  ok(systemCardDateLine({ lawCardIssuedHijri: "1447/01/13" }) === "صدر: 1447/01/13هـ", "E-5 تاريخ الإصدار من بطاقة المصدر");
  ok(systemCardDateLine({ coreIssuanceH: "1444-11-29", lawCardIssuedHijri: "1400/01/01" }) === "صدر: 29 / 11 / 1444هـ", "E-5 تاريخ الركيزة يتقدم");
  const card = read("components/legal-core.tsx");
  ok(!card.includes("عند التوفر"), "E-5 عبارة «تاريخ النفاذ: عند التوفر» المضللة أُزيلت");
  ok(!card.includes('<LegalTopicBadge tone="emerald">ساري</LegalTopicBadge>'), "E-5 شارة «ساري» الثابتة لكل نظام أُزيلت");
  ok(systemCardStatus(UNVERIFIED_NOTICE).label === STATUS_UNVERIFIED_SHORT, "E-5 بلا سجل تحقق: «الحالة قيد التحقق» لا «ساري»");
  ok(systemCardStatus("ملغى").tone === "ruby" && systemCardStatus("مستبدل").tone === "ruby", "E-5 الملغى والمستبدل بشارة حمراء");
  ok(systemCardStatus("ساري").tone === "emerald" && systemCardStatus("صادر لم يسرِ بعد").tone === "amber", "E-5 الساري أخضر والصادر قبل نفاذه كهرماني");

  // L12-10 / E-6: قسم المحتوى القانوني في قائمة الإدارة.
  const superSections = ADMIN_NAV_SECTIONS.super;
  const legal = superSections.find((s) => s.key === "legal");
  const general = superSections.find((s) => s.key === "general");
  ok(!!legal && legal.title === "المحتوى القانوني", "L12-10 قسم مستقل «المحتوى القانوني» في قائمة السوبر أدمن");
  const legalHrefs = new Set(legal?.links.map((l) => l.href) ?? []);
  const required = [
    "/admin/legal",
    "/admin/legal/queue",
    "/admin/legal/audit",
    "/dashboard/legal-core/admin",
    "/dashboard/legal-core/quality",
    "/dashboard/legal-core/citations/dashboard",
    "/dashboard/legal-core/principles",
    "/dashboard/legal-core/systems",
    "/dashboard/legal-core/judgments",
  ];
  ok(required.every((h) => legalHrefs.has(h)), "L12-10 القسم يضم مكتب التحرير وصفحات الإدارة القانونية كلها");
  ok(!!general && general.links.every((l) => !l.href.startsWith("/admin/legal") && !l.href.startsWith("/dashboard/legal-core")), "L12-10 لا روابط قانونية مبعثرة في القسم العام");
  ok([...legalHrefs].every((h) => existsSync(join(root, "app", h, "page.tsx"))), "L12-10 كل رابط في القسم يقابله ملف صفحة قائم");
  const sysLegal = ADMIN_NAV_SECTIONS.system.find((s) => s.key === "legal");
  ok(!!sysLegal && sysLegal.links.some((l) => l.href === "/dashboard/legal-core/admin") && !sysLegal.links.some((l) => l.href.startsWith("/admin/legal")), "L12-10 مدير النظام يرى قسم النواة بلا مكتب التحرير (يحرسه التكليف)");
  const allSuper = superSections.flatMap((s) => s.links);
  ok(activeAdminHref("/admin/legal/queue", allSuper) === "/admin/legal/queue", "L12-10 الرابط النشط واحد (الأطول مطابقة)");
  ok(activeAdminHref("/admin", allSuper) === "/admin" && activeAdminHref("/admin/users/x", allSuper) === "/admin/users", "L12-10 مطابقة الجذر والمسارات الفرعية");
}

// ── الجزء الثاني: قاعدة محلية ببيانات اصطناعية ──────────────────────────────

type PgResult = { rows: Record<string, unknown>[] };
interface PgClientLike {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<PgResult>;
  end(): Promise<void>;
}
interface PgPoolLike {
  query(sql: string, params?: unknown[]): Promise<PgResult>;
  end(): Promise<void>;
}
interface PgModule {
  Client: new (config: { connectionString: string }) => PgClientLike;
  Pool: new (config: { connectionString: string; max?: number }) => PgPoolLike;
}

function guardTestUrl(raw: string): URL {
  const url = new URL(raw);
  const db = url.pathname.replace(/^\//, "");
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) throw new Error("LEGAL_METRICS_TEST_DATABASE_URL يجب أن يشير إلى مضيف محلي فقط.");
  if (!/_test$/.test(db)) throw new Error("اسم قاعدة الاختبار يجب أن ينتهي بـ _test.");
  return url;
}

const SYN = "اصطناعي";

async function seed(w: PgClientLike) {
  await w.query(`INSERT INTO legal_systems (id, name, domain, domain_title, sort_order) VALUES
    ('s1','نظام أ (${SYN})','CIV','المدني',1),
    ('s2','نظام ب (${SYN})',NULL,NULL,0),
    ('s3','نظام ج (${SYN})','  ',NULL,0),
    ('s4','نظام د (${SYN})','COM','التجاري',2),
    ('s5','نظام هـ (${SYN})',NULL,NULL,0)`);
  await w.query(`INSERT INTO law_card (id, system_id, official_name, issued_hijri, source_name, source_url, retrieved_on, created_by, created_at) VALUES
    ('c1','s1','نظام أ (${SYN})','1440/01/01','${SYN}','https://example.test/1','2026-10-17','test','2026-10-01'),
    ('c4a','s4','نظام د (${SYN})','1430/01/01','${SYN}','https://example.test/4','2026-10-17','test','2026-09-01'),
    ('c4b','s4','نظام د (${SYN})',NULL,'${SYN}','https://example.test/4','2026-10-17','test','2026-10-01')`);
  // بطاقة بتاريخ ميلادي وحده: البطاقة لا تعرضه، فلا يُعدّ «له تاريخ إصدار» (ن-٢).
  await w.query(`INSERT INTO law_card (id, system_id, official_name, issued_gregorian, source_name, source_url, retrieved_on, created_by) VALUES
    ('c5','s5','نظام هـ (${SYN})','2020-01-01','${SYN}','https://example.test/5','2026-10-17','test')`);
  await w.query(`INSERT INTO verification (id, object_type, object_id, verified_status, method) VALUES
    ('v1','work','s1','ساري','rule'), ('v4','work','s4','ملغى','manual'), ('vu','unit','a1','ساري','rule'),
    ('v2','work','s2','سجل مخلوط — لا يُعرض','owner_decision')`);
  // ثماني مواد بحالات نقص مقصودة (التوقع في التعليق).
  await w.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", title, content, chapter, keywords, "royalDecree") VALUES
    ('a1','s1','نظام أ (${SYN})','x',1,'م١','نص ${SYN}','باب',ARRAY['k'],NULL),
    ('a2','s1','نظام أ (${SYN})',NULL,2,'م٢','نص ${SYN}','باب',ARRAY['k'],NULL),
    ('a3','s1','نظام أ (${SYN})','  ',3,'م٣','نص ${SYN}','باب','{}',NULL),
    ('a4','s1','نظام أ (${SYN})','x',4,'م٤','نص ${SYN}','',ARRAY[' ',''],NULL),
    ('a5','s4','نظام د (${SYN})','x',1,'م١','نص ${SYN}',NULL,NULL,NULL),
    ('a6','s4','نظام د (${SYN})','y',2,'م٢','نص ${SYN}','   ',ARRAY['k'],NULL),
    ('a7','s4','نظام د (${SYN})','x',3,'م٣','نص ${SYN}','فصل',ARRAY['k'],'م/1'),
    ('a8','s4','نظام د (${SYN})','y',4,'م٤','نص ${SYN}','فصل',ARRAY['k2'],'  ')`);
  await w.query(`INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation) VALUES
    ('r1','article','a1','system','s1','IMPLEMENTS'), ('r2','system','s1','article','a2','RELATED_TO')`);
  await w.query(`INSERT INTO judicial_cases (id, "judgmentText") VALUES
    ('j1','نص حكم ${SYN}'),('j2','نص حكم ${SYN}'),('j3','نص حكم ${SYN}'),('j4','نص حكم ${SYN}'),('j5','نص حكم ${SYN}'),('j6','نص حكم ${SYN}')`);
  await w.query(`INSERT INTO legal_article_case_links (id, "articleId", "caseId", "relationType", "reviewStatus") VALUES
    ('l1','a1','j1','applied','needs_review'), ('l2','a2','j1','cited','needs_review'),
    ('l3','a1','j2','applied','rejected'), ('l4','a3','j3','procedural_reference','verified')`);
  await w.query(`INSERT INTO judicial_principles (id, title, "principleText", "sourceCaseId", court, "reviewStatus", "createdAt") VALUES
    ('p1','مبدأ 500 (${SYN})','نص مبدأ ${SYN}','j1','المحكمة العامة (${SYN})','needs_review','2026-10-01'),
    ('p2','نسبة 50% (${SYN})','نص مبدأ ${SYN}','j1','المحكمة العامة (${SYN})','needs_review','2026-10-02'),
    ('p3','مبدأ مرفوض (${SYN})','نص مبدأ ${SYN}','j1','المحكمة العامة (${SYN})','rejected','2026-10-03'),
    ('p4','مبدأ معتمد (${SYN})','نص مبدأ ${SYN}','j2','المحكمة التجارية (${SYN})','reviewed','2026-10-04'),
    ('p5','مبدأ مدمج (${SYN})','نص مبدأ ${SYN}','j3','المحكمة التجارية (${SYN})','merged','2026-10-05')`);
}

/** شكل الاستعلام الذي يولّده Prisma 5 لمرشح العلاقة articleLinks: { none: {} } / { some: {} } (قائمة الأحكام). */
const PRISMA_RELATION_FILTER = {
  none: `SELECT count(*)::int AS c FROM judicial_cases t0 WHERE (t0.id) NOT IN (SELECT t1."caseId" FROM legal_article_case_links AS t1 WHERE (1=1 AND t1."caseId" IS NOT NULL))`,
  some: `SELECT count(*)::int AS c FROM judicial_cases t0 WHERE (t0.id) IN (SELECT t1."caseId" FROM legal_article_case_links AS t1 WHERE (1=1 AND t1."caseId" IS NOT NULL))`,
};

/** ركيزة اصطناعية بتاريخ مكتوب في الكود (بديل core-systems.ts في الاختبار). */
const CORE_NAMES = [`نظام ج (${SYN})`];

const ISSUES: LegalIssuesCounts = { total: 10, byStatus: { linked: 5, needs_review: 2, review_nizam: 1, uncodified_sharia: 2 } };

async function dbTests(pg: PgModule, rawUrl: string) {
  console.log("\n— قاعدة محلية (بيانات اصطناعية) —");
  const url = guardTestUrl(rawUrl);
  const dbName = url.pathname.replace(/^\//, "");
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  // اتصال الكتابة للتحضير وحده، واتصال الخدمة READ ONLY.
  const writer = new pg.Client({ connectionString: url.toString() });
  await writer.connect();
  await writer.query(read("scripts/legal-metrics/fixtures/schema.sql"));
  await seed(writer);

  // مجمّع اتصالات كما يفعل Prisma (استعلامات متوازية)، وكل اتصال فيه READ ONLY من خيار الاتصال.
  const readerUrl = new URL(url.toString());
  readerUrl.searchParams.set("options", "-c default_transaction_read_only=on");
  const reader = new pg.Pool({ connectionString: readerUrl.toString(), max: 6 });
  let refused = false;
  try {
    await reader.query(`INSERT INTO legal_systems (id, name) VALUES ('w','كتابة ممنوعة')`);
  } catch (error) {
    refused = /read-only|25006/.test(String((error as { code?: string; message?: string }).code ?? "") + String((error as Error).message));
  }
  ok(refused, "L0-1 اتصال الخدمة في الاختبار يرفض الكتابة فعلًا (READ ONLY)");
  const issued: string[] = [];
  const sql: MetricsSql = {
    query: async <T>(text: string, params: readonly unknown[] = []) => {
      issued.push(text);
      return (await reader.query(text, params as unknown[])).rows as T[];
    },
  };
  const num = async (text: string) => Number(Object.values((await writer.query(text)).rows[0])[0]);
  const load = (groups?: readonly MetricGroup[], legalIssues: () => LegalIssuesCounts | null = () => ISSUES) =>
    loadLegalMetrics(sql, { groups, legalIssues, coreIssuedNames: CORE_NAMES });
  const n = (s: LegalMetricsSnapshot, id: MetricId) => metricNumber(metric(s, id).value);

  const full = await load();
  ok(issued.length > 0 && issued.every((t) => /^\s*(SELECT|WITH)\b/i.test(t)), `L0-1 الخدمة قراءة فقط على اتصال READ ONLY (${issued.length} عبارة SELECT/WITH)`);
  const unexpected = METRIC_IDS.filter((id) => full.metrics[id]?.value.kind === "unavailable" && id !== "articles.duplicates" && id !== "explanations.withoutSource");
  ok(unexpected.length === 0, `L0-1 كل المقاييس تُقرأ على مخطط الإنتاج${unexpected.length ? ` — متعذّر: ${unexpected.join(", ")}` : ""}`);
  ok(METRIC_IDS.every((id) => !!full.metrics[id]), "L0-1 اللقطة الكاملة تحوي كل المقاييس المعرّفة");

  // التعريفات على البيانات الاصطناعية.
  ok(n(full, "systems.total") === 5 && n(full, "systems.unclassified") === 3, "E-5 «غير مصنّف» = نظام بلا مجال (NULL أو فراغ): ٣ من ٥");
  ok(n(full, "systems.noIssuanceDate") === 3, "E-5/N-2 بلا تاريخ إصدار كالبطاقة: بلا بطاقة، أو آخر بطاقة بلا هجري، أو ميلادي وحده؛ والركيزة ذات التاريخ المكتوب لا تُعدّ: ٣");
  ok(n(full, "systems.unverifiedStatus") === 3, "E-5/N-1 بلا حالة موثّقة كالبطاقة: بلا سجل، أو آخره «سجل مخلوط»: ٣ (سجل unit لا يُحسب)");
  ok(n(full, "articles.total") === 8, "L0-1 المواد ٨");
  ok(n(full, "articles.noClassification") === 2, "L0-1 بلا تصنيف يشمل الفراغ: ٢");
  ok(n(full, "articles.noKeywords") === 3, "L0-1 بلا كلمات يشمل NULL والمصفوفة الفارغة وعناصر الفراغ: ٣");
  ok(n(full, "articles.noChapter") === 1, "M-3 بلا باب بالتعريف القائم (NULL فقط) حتى قرار المالك: ١ ('' والفراغ لا يُعدّان)");
  ok(n(full, "articles.needsReview") === 4, "L0-1 تحتاج مراجعة = اتحاد النواقص الثلاثة بلا ازدواج: ٤");
  ok(n(full, "articles.decreeFilled") === 1 && n(full, "articles.classifications") === 2, "L0-1 المرسوم غير الفارغ ١، والتصنيفات المميّزة ٢");
  ok(n(full, "articles.noRelations") === 7 && n(full, "articles.relationsTotal") === 2, "L0-1 بلا علاقات = ليست مصدرًا لعلاقة: ٧، والعلاقات ٢");
  // مراجعة الجودة ع١: أعداد مركز التشغيل الذكي هي أعداد الخدمة نفسها.
  const intel = summaryFromMetrics(await load(["systems", "articles", "judgments", "citations"]));
  ok(
    intel.reviewNeededCount === n(full, "articles.needsReview") &&
      intel.unlinkedRulingsCount === n(full, "judgments.unlinked") &&
      intel.articlesCount === 8 && intel.systemsCount === 5 && intel.linkedArticlesCount === 3 && intel.relationsCount === 2 && intel.classificationsCount === 2,
    "L0-1 مركز التشغيل الذكي يعرض «تحتاج مراجعة» و«أحكام بلا مواد» من الخدمة (رقم واحد في الصفحة الرئيسية)",
  );
  ok(n(full, "judgments.total") === 6 && n(full, "judgments.linked") === 3, "E-1 الأحكام ٦ والمرتبطة ٣ (منها حكم رابطه مرفوض)، بعدّ caseId المميز (م-٢)");
  ok(n(full, "judgments.unlinked") === 3 && n(full, "judgments.unlinked") === (n(full, "judgments.total") ?? 0) - (n(full, "judgments.linked") ?? 0), "E-1 بلا رابط = ٣ = الأحكام − المرتبطة (لا صفر ثابت)");
  ok(n(full, "citations.total") === 4 && n(full, "citations.pending") === 2 && n(full, "citations.verified") === 1 && n(full, "citations.rejected") === 1, "L0-1 الروابط ٤ بحالاتها ٢/١/١");
  ok(n(full, "citations.articlesLinked") === 3, "L0-1 مواد لها روابط ٣");
  const rel = full.breakdowns.citationsByRelation;
  ok(!!rel?.ok && rel.rows.reduce((s, r) => s + r.count, 0) === rel.total && rel.total === 4, "L0-1 توزيع العلاقات مجموعه = الروابط");
  ok(n(full, "issues.total") === 10 && n(full, "issues.needsReview") === 3 && n(full, "issues.uncodified") === 2, "L0-1 المسائل من الفهرس: تحتاج مراجعة = needs_review + review_nizam");

  // L0-1: «أحكام بلا رابط» رقم واحد في كل الصفحات (مجموعات /quality و/citations/dashboard واللوحة).
  const qualityGroups = await load(["articles", "explanations", "judgments"]);
  const citationGroups = await load(["judgments", "citations"]);
  const unlinkedEverywhere = [n(qualityGroups, "judgments.unlinked"), n(citationGroups, "judgments.unlinked"), n(full, "judgments.unlinked")];
  ok(unlinkedEverywhere.every((v) => v === 3), `L0-1 «الأحكام بلا رابط» رقم واحد في /quality و/citations/dashboard واللوحة (${unlinkedEverywhere.join("، ")})`);
  let threw = false;
  try {
    metric(citationGroups, "articles.total");
  } catch {
    threw = true;
  }
  ok(threw, "L0-1 طلب مقياس من مجموعة لم تُحمَّل خطأ برمجي لا صفر");

  // L0-2: كل عدّاد له طابور يطابق عدد صفوف الطابور الذي يفتحه.
  const queueCount: Partial<Record<MetricId, () => Promise<number>>> = {
    "systems.total": () => num(`SELECT count(*)::int FROM legal_systems`), // listSystems: count بلا مرشح
    "judgments.total": () => num(`SELECT count(*)::int FROM judicial_cases`),
    "judgments.linked": () => num(PRISMA_RELATION_FILTER.some),
    "judgments.unlinked": () => num(PRISMA_RELATION_FILTER.none),
    "principles.total": async () => (await listPrinciples(sql, { status: PRINCIPLE_STATUS_ALL })).total,
    "principles.reviewed": async () => (await listPrinciples(sql, { status: "reviewed" })).total,
    "principles.pending": async () => (await listPrinciples(sql, { status: "needs_review" })).total,
    "principles.rejected": async () => (await listPrinciples(sql, { status: "rejected" })).total,
    "issues.total": async () => ISSUES.total, // صفحة المسائل تعرض getLegalIssuesOverview().total من الملف نفسه
  };
  const withQueue = METRIC_IDS.filter((id) => METRIC_DEFINITIONS[id].queue);
  ok(withQueue.every((id) => !!queueCount[id]), `L0-2 لكل عدّاد له طابور فحصُ مطابقة (${withQueue.length} طابورًا)`);
  for (const id of withQueue) {
    const check = queueCount[id];
    if (!check) continue;
    const queueRows = await check();
    ok(queueRows === n(full, id), `L0-2 ${id}: العدّاد ${n(full, id)} = صفوف الطابور ${queueRows} (${METRIC_DEFINITIONS[id].queue?.href})`);
  }
  ok(METRIC_DEFINITIONS["systems.total"].queue?.href === SYSTEMS_QUEUE && METRIC_DEFINITIONS["issues.total"].queue?.href === ISSUES_PAGE, "L0-2 روابط طابوري الأنظمة والمسائل");

  // L5-6: مجموع الحالات = الإجمالي، والحالات كلها في المرشح.
  const byStatus = full.breakdowns.principlesByStatus;
  ok(!!byStatus?.ok && byStatus.rows.reduce((s, r) => s + r.count, 0) === n(full, "principles.total"), "L5-6 statuses sum to total");
  ok(!!byStatus?.ok && byStatus.rows.some((r) => r.key === "merged" && r.count === 1 && r.label.includes("merged")), "L5-6 الحالة غير المعروفة تظهر بنفسها في المرشح");
  ok(!!byStatus?.ok && byStatus.rows.every((r) => r.href === principleQueueHref(r.key)), "L5-6 كل حالة في المرشح رابط لطابورها");
  const desk = inContext(full, "desk");
  ok(
    metric(desk, "principles.pending").queue?.href === "/admin/legal/queue?tab=principles" &&
      n(desk, "principles.pending") === n(full, "principles.pending") &&
      metric(full, "principles.pending").queue?.href === principleQueueHref("needs_review"),
    "L0-2 سياق المكتب يغيّر الطابور لا الرقم، ولا يمس سياق النواة",
  );
  ok((await listPrinciples(sql, {})).total === 4, "L5-6 الافتراضي «الكل عدا المرفوض» = الإجمالي − المرفوض (٤)");
  ok((await listPrinciples(sql, { q: "50%", status: PRINCIPLE_STATUS_ALL })).total === 1, "L5-6 البحث يهرّب % فلا يطابق «500»");
  ok((await listPrinciples(sql, { court: `المحكمة التجارية (${SYN})`, status: PRINCIPLE_STATUS_ALL })).total === 2, "L5-6 مرشح المحكمة");
  const page2 = await listPrinciples(sql, { status: PRINCIPLE_STATUS_ALL, page: 2, pageSize: 2 });
  ok(page2.total === 5 && page2.items.length === 2 && page2.items[0].id === "p3", "L5-6 الترقيم بالأحدث أولًا");
  const courts = await principleCourts(sql);
  ok(courts.length === 2 && courts[0].count === 3, "L5-6 قائمة المحاكم بأعدادها");
  // كالإنتاج: لا مبدأ معتمدًا، والحالة تبقى ظاهرة بصفر.
  await writer.query(`UPDATE judicial_principles SET "reviewStatus"='needs_review' WHERE id='p4'`);
  const zeroReviewed = await load(["principles"]);
  const zr = zeroReviewed.breakdowns.principlesByStatus;
  ok(!!zr?.ok && zr.rows.some((r) => r.key === "reviewed" && r.count === 0) && zr.total === 5, "L5-6 «معتمد» يبقى في المرشح بصفر، والمجموع ثابت");
  ok(n(zeroReviewed, "principles.reviewed") === 0 && metric(zeroReviewed, "principles.reviewed").value.kind === "count", "L5-6 صفر المعتمد عدّ حقيقي لا «غير متاح»");

  // L0-4 / E-2: لا ينطبق.
  ok(metric(full, "explanations.total").value.kind === "not_applicable", "M-1 «الشروح» لا ينطبق: لا جدول شروح بمصدر بعد");
  ok(metric(full, "explanations.withoutSource").value.kind === "not_applicable", "L0-4 not-applicable: «شروح بلا مصدر» لا ينطبق ما دامت الشروح صفرًا");
  ok(formatMetricValue(metric(full, "explanations.withoutSource").value) === "لا ينطبق", "L0-4 ويُعرض «لا ينطبق» لا «٠»");
  ok(metric(full, "articles.noExplanation").value.kind === "not_applicable", "M-1 «مواد بلا شرح» لا ينطبق كذلك");
  ok(metric(full, "fiqh.alignmentsPending").value.kind === "not_applicable", "L0-4 المواءمات لا تنطبق ما دامت النصوص الفقهية صفرًا");
  await writer.query(`INSERT INTO annotations (id, user_id, document_type, document_id, note) VALUES ('n1','u','article','a1','ملاحظة ${SYN}'), ('n2','u','article','a2','   ')`);
  await writer.query(`INSERT INTO fiqh_sources (id, source_title, source_type, verification_status) VALUES ('fs1','كتاب ${SYN}','book','unverified')`);
  await writer.query(`INSERT INTO fiqh_texts (id, source_id, text_original, deleted_at) VALUES ('ft1','fs1','نص ${SYN}',NULL), ('ft2','fs1','نص ${SYN}',now())`);
  await writer.query(`INSERT INTO fiqh_article_alignments (id, article_id, fiqh_text_id, alignment_type, review_status, deleted_at) VALUES
    ('fa1','a1','ft1','موافق','needs_review',NULL), ('fa2','a1','ft1','موافق','needs_review',now()), ('fa3','a2','ft1','موافق','reviewed',NULL)`);
  const after = await load(["explanations", "fiqh"]);
  ok(
    metric(after, "explanations.total").value.kind === "not_applicable" && metric(after, "explanations.withoutSource").value.kind === "not_applicable",
    "M-1 ملاحظة مستخدم خاصة على مادة لا تصير «شرحًا» في عدّاد عام",
  );
  ok(n(after, "fiqh.sources") === 1 && n(after, "fiqh.texts") === 1 && n(after, "fiqh.alignmentsPending") === 1, "L0-1 الفقهي: المحذوف لا يُعدّ (١/١/١)");

  // المصدر المتعذّر «غير متاح» لا صفر، ولا يُسقط بقية المجموعة.
  await writer.query(`DROP TABLE legal_relations`);
  await writer.query(`DROP TABLE fiqh_sources`);
  const broken = await load(["articles", "fiqh"], () => null);
  ok(
    metric(broken, "articles.noRelations").value.kind === "unavailable" && metricNumber(metric(broken, "articles.relationsTotal").value) === null,
    "L0-4 جدول العلاقات الغائب: «غير متاح» لا صفر",
  );
  ok(n(broken, "articles.total") === 8 && n(broken, "articles.needsReview") === 4, "L0-4 وبقية مقاييس المواد تُقرأ");
  ok(metric(broken, "fiqh.sources").value.kind === "unavailable" && n(broken, "fiqh.texts") === 1, "L0-4 مصدر فقهي غائب لا يصفّر النصوص");
  const noIssues = await load(["issues"], () => null);
  ok(metric(noIssues, "issues.total").value.kind === "unavailable", "L0-4 فهرس المسائل الغائب «غير متاح» لا صفر");
  const throwingIssues = await load(["issues"], () => {
    throw new Error("boom");
  });
  ok(metric(throwingIssues, "issues.total").value.kind === "unavailable", "L0-4 خطأ قراءة الفهرس «غير متاح»");
  ok(issued.every((t) => /^\s*(SELECT|WITH)\b/i.test(t)), `L0-1 لا كتابة من الخدمة في كل الجولات (${issued.length} عبارة)`);

  await reader.end();
  await writer.end();
}

async function main() {
  pureTests();
  const url = process.env.LEGAL_METRICS_TEST_DATABASE_URL;
  if (!url) {
    console.log("\n(تخطّي اختبارات القاعدة: LEGAL_METRICS_TEST_DATABASE_URL غير مضبوط — قاعدة محلية للاختبار فقط)");
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
