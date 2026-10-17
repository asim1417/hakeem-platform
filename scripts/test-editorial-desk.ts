/**
 * اختبارات مكتب التحرير التشريعي — المرحلة صفر (T0-1 … T0-9)، والتوحيد مع #723 (HKM-023):
 * السياسات والتكليف والنطاق، وتعدد الموافقات، والناشر، والتراجع المحروس، والاستقبال المعلّق، وأم القرى،
 * وعقد الواجهة، والحماية (TRUNCATE والمشغّل المعطّل)، وأخطاء بشكل Prisma (P2010 + meta.code).
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
import { pgErrorCode, type EditorialDb, type SqlClient } from "../lib/modules/editorial/db";
import { canManageSettings, canReadAudit, inScope } from "../lib/modules/editorial/access";
import { hijriToGregorian } from "../lib/modules/editorial/hijri";
import { decodePathParam, deskPreflight, MAX_BODY_BYTES, parseBodyText } from "../lib/modules/editorial/http-guard";
import { checkDeskIntegrity } from "../lib/modules/editorial/integrity";
import {
  bulkApproveAmendmentOps,
  decideAmendmentOp,
  decidePrinciple,
  intakeCounts,
  listAmendmentQueue,
  listPrincipleQueue,
  validateCorrection,
} from "../lib/modules/editorial/intake";
import { payloadHash } from "../lib/modules/editorial/payload";
import { getSystemSummary, listAudit, listChangeSetsDetailed, summarizeChange } from "../lib/modules/editorial/read";
import { previewEditorialSettings, readEditorialSettings, saveEditorialSettings, setDeskWriteSwitch } from "../lib/modules/editorial/settings";
import {
  createChangeSet,
  decideChangeSet,
  publishChangeSet,
  revertChangeSet,
  submitChangeSet,
  validateEvidence,
  withdrawChangeSet,
} from "../lib/modules/editorial/service";
import { EditorialError, type ChangeInput, type EditorialActor } from "../lib/modules/editorial/types";
import {
  controlsOf,
  DEFAULT_CONTROLS,
  DEFAULT_EDITORIAL_CONFIG,
  editorialConfigSchema,
  loadEditorialConfig,
  type EditorialBinding,
  type EditorialConfig,
} from "../lib/modules/editorial/policy";
import { deskWriteDenial, envWriteLock, envWriteSwitch, isDeskLive, isEditorialWriteEnabled, KILL_SWITCH_MESSAGE, PREVIEW_LOCK_MESSAGE, READ_ONLY_MESSAGE } from "../lib/modules/editorial/write-gate";
import { PRINCIPLE_REVIEW_STATUS } from "../lib/modules/legal-core/principle-review";
import { runDeskUiTests } from "./test-editorial-desk-ui";

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
  const owner = resolveEditorialAccess("SUPER_ADMIN", null);
  ok(owner.superAdmin && owner.editorLaws && owner.reviewer && owner.publisher && owner.qaView && !owner.agent, "SUPER_ADMIN يملك صلاحيات المكتب كلها ولا يُعامل وكيلًا");
  const sysAdmin = resolveEditorialAccess("SYSTEM_ADMIN", null);
  ok(!sysAdmin.editorLaws && !sysAdmin.reviewer && !sysAdmin.qaView, "SYSTEM_ADMIN بلا تكليف لا يملك شيئًا من المكتب (لا تجاوز كما في canUser)");
  const reviewer = resolveEditorialAccess("LAWYER", binding("u", ["reviewer"]));
  ok(reviewer.reviewer && !reviewer.editorLaws, "التكليف الصريح يعطي الدور المكلَّف به وحده");
  const agent = resolveEditorialAccess("TRAINEE", binding("a", ["editor_laws", "reviewer"], "agent"));
  ok(agent.agent && !agent.reviewer, "حساب الوكيل لا يعتمد ولو كُلّف بالمعتمِد خطأً");

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
  ok(
    routeSource.indexOf("deskIsLive()") > 0 && routeSource.indexOf("deskIsLive()") < routeSource.indexOf("judicialPrinciple") && routeSource.includes("USE_EDITORIAL_DESK"),
    "SW-10 زر المبدأ القديم يتوقف قبل أي كتابة حين تعمل الكتابة في المكتب، ويحيل إليه",
  );
  // خ٤ (مراجعة الجودة على f8d7a92): أفعال الكتابة تسأل عن التحقق الثنائي طازجًا، والمخزن لا يُستعمل مع fresh.
  const guardSrc = readFileSync(join(process.cwd(), "lib/modules/editorial/guard.ts"), "utf8");
  const mfaSource = readFileSync(join(process.cwd(), "lib/modules/editorial/mfa.ts"), "utf8");
  ok(
    /request\.method !== "GET"[\s\S]{0,160}accountMfaStatus\(actor\.id, \{ fresh: true \}\)/.test(guardSrc),
    "SW-15 أفعال الكتابة (غير GET) تحسب التحقق الثنائي بسؤال طازج لا من المخزن",
  );
  ok(/if \(!opts\.fresh && hit && /.test(mfaSource) && /if \(!status\.error\) cache\.set/.test(mfaSource), "SW-15 المخزن يُتجاوز مع fresh، والخطأ لا يُخزَّن");

  ok(pgErrorCode({ code: "P2010", meta: { code: "23505" } }) === "23505", "رمز التكرار يُقرأ من خطأ Prisma (meta.code) لا P2010");
  ok(pgErrorCode({ code: "23505" }) === "23505", "رمز التكرار يُقرأ من خطأ pg");
  ok(pgErrorCode({ code: "P2010", meta: {}, message: "Raw query failed. Code: `23505`." }) === "23505", "ويُقرأ من نص الرسالة عند غياب meta");
  ok(pgErrorCode({ code: "P2002" }) === null, "رمز Prisma وحده لا يُعدّ رمز قاعدة");
  ok(!isEditorialWriteEnabled(null, {}), "غياب EDITORIAL_DESK_WRITE والإعدادات = قراءة فقط");
  ok(isEditorialWriteEnabled(null, { EDITORIAL_DESK_WRITE: "1" }), "EDITORIAL_DESK_WRITE=1 يفتح الكتابة");
  // مفتاح اللوحة (قرار المالك 22:13)
  ok(DEFAULT_CONTROLS.writeEnabled === false && DEFAULT_CONTROLS.requireMfa === true, "SW-0 الافتراض: الكتابة مقفلة والتحقق الثنائي مشروط");
  ok(controlsOf({}).writeEnabled === false && controlsOf(null).requireMfa === true, "SW-0 نسخة بلا controls = الافتراض");
  ok(isEditorialWriteEnabled({ controls: { writeEnabled: true, requireMfa: true } }, {}), "SW-0 مفتاح اللوحة يفتح بلا متغير البيئة");
  ok(!isEditorialWriteEnabled({ controls: { writeEnabled: true, requireMfa: true } }, { EDITORIAL_DESK_WRITE: "0" }), "SW-0 مفتاح الطوارئ (0) يقفل فوق اللوحة");
  ok(envWriteSwitch({ EDITORIAL_DESK_WRITE: " 0 " }) === "kill" && envWriteSwitch({ EDITORIAL_DESK_WRITE: "yes" }) === "panel", "SW-0 قراءة المتغير: 0 طوارئ، 1 قسري، غيرهما اللوحة");
  const on = { writeEnabled: true, requireMfa: true };
  ok(deskWriteDenial({ env: "panel", controls: on, actorKind: "human", mfa: true }) === null, "SW-0 بشري بتحقق ثنائي يكتب");
  ok(deskWriteDenial({ env: "panel", controls: on, actorKind: "human", mfa: false })?.code === "MFA_REQUIRED", "SW-0 بشري بلا تحقق ثنائي يُرفض");
  ok(deskWriteDenial({ env: "panel", controls: on, actorKind: "human", mfa: null })?.code === "MFA_REQUIRED", "SW-0 التحقق غير المحسوب = غير متحقق (فشل مغلق)");
  ok(deskWriteDenial({ env: "panel", controls: on, actorKind: "agent", mfa: null }) === null, "SW-0 الوكيل يقترح بلا شرط التحقق الثنائي");
  ok(deskWriteDenial({ env: "panel", controls: { writeEnabled: true, requireMfa: false }, actorKind: "human", mfa: false }) === null, "SW-0 بلا شرط: يكتب بلا تحقق ثنائي");
  ok(deskWriteDenial({ env: "force_on", controls: { writeEnabled: false, requireMfa: true }, actorKind: "human", mfa: false })?.code === "MFA_REQUIRED", "SW-0 التشغيل القسري لا يُسقط شرط التحقق الثنائي");
  ok(deskWriteDenial({ env: "kill", controls: on, actorKind: "human", mfa: true })?.message === KILL_SWITCH_MESSAGE, "SW-0 مفتاح الطوارئ برسالته");
  // مراجعة الجودة م١ على 7681ec8: نسخ المعاينة تشارك قاعدة الإنتاج فتُقفل افتراضيًا.
  ok(envWriteSwitch({ VERCEL_ENV: "preview" }) === "kill" && envWriteLock({ VERCEL_ENV: "preview" }) === "preview", "SW-11 المعاينة بلا متغير = مقفلة");
  ok(envWriteSwitch({ VERCEL_ENV: "preview", EDITORIAL_DESK_WRITE: "1" }) === "force_on" && envWriteSwitch({ VERCEL_ENV: "production" }) === "panel" && envWriteSwitch({}) === "panel", "SW-11 المعاينة تُفتح بـ 1 صراحةً، والإنتاج والمحلي يتبعان اللوحة");
  ok(envWriteLock({ VERCEL_ENV: "preview", EDITORIAL_DESK_WRITE: "0" }) === "env_zero", "SW-11 مفتاح الطوارئ في المعاينة برسالته");
  ok(!isEditorialWriteEnabled({ controls: on }, { VERCEL_ENV: "preview" }), "SW-11 مفتاح اللوحة المفتوح لا يفتح المعاينة");
  ok(deskWriteDenial({ env: "kill", lock: "preview", controls: on, actorKind: "human", mfa: true })?.message === PREVIEW_LOCK_MESSAGE, "SW-11 رفض المعاينة برسالة المعاينة لا الطوارئ");
  ok(isDeskLive({ controls: on }, { VERCEL_ENV: "preview" }) && isDeskLive({ controls: on }, { EDITORIAL_DESK_WRITE: "0" }), "SW-11 المكتب حيّ في كل البيئات متى شغّل المالك المفتاح (زر المبدأ القديم موقوف)");
  ok(isDeskLive({ controls: { writeEnabled: false, requireMfa: true } }, { EDITORIAL_DESK_WRITE: "1" }) && !isDeskLive({ controls: { writeEnabled: false, requireMfa: true } }, {}), "SW-11 التشغيل القسري حيّ، والمقفل غير حيّ");
  ok(editorialConfigSchema.safeParse({ ...DEFAULT_EDITORIAL_CONFIG, controls: { writeEnabled: true } }).success === false, "SW-0 controls ناقصة تُرفض");
  ok(READ_ONLY_MESSAGE.includes("للقراءة فقط"), "رسالة القراءة فقط صريحة");

  console.log("\n— نقي: التوحيد —");
  // ق-١٠ حراسة الطلب
  const pre = { authDisabled: false, method: "POST", origin: "https://hakeem.example", requestOrigin: "https://hakeem.example", host: "hakeem.example", forwardedHost: null, contentLength: "100" };
  ok(deskPreflight({ ...pre, authDisabled: true, method: "GET" })?.status === 401, "ق-١٠ المصادقة المعطّلة ترفض المكتب (401) حتى للقراءة");
  ok(deskPreflight(pre) === null, "طلب كتابة من أصل التطبيق يُقبل");
  ok(deskPreflight({ ...pre, origin: null })?.status === 403, "طلب كتابة بلا Origin يُرفض");
  ok(deskPreflight({ ...pre, origin: "https://evil.example" })?.status === 403, "طلب كتابة من أصل آخر يُرفض");
  ok(deskPreflight({ ...pre, requestOrigin: "https://deploy-x.vercel.app", host: "hakeem.example" }) === null, "Origin يطابق مضيف الطلب نفسه (النطاق المخصص) فيُقبل");
  ok(deskPreflight({ ...pre, requestOrigin: "https://deploy-x.vercel.app", host: "deploy-x.vercel.app", forwardedHost: "hakeem.example" })?.status === 403, "ن٧ X-Forwarded-Host من العميل لا يُعتمد في فحص Origin");
  ok(deskPreflight({ ...pre, origin: "http://evil.example", requestOrigin: "https://deploy-x.vercel.app", host: "deploy-x.vercel.app", forwardedHost: "evil.example" })?.status === 403, "ن٧ ولا يمرّر أصلًا غريبًا يطابقه");
  ok(deskPreflight({ ...pre, method: "GET", origin: null }) === null, "القراءة لا تشترط Origin");
  ok(deskPreflight({ ...pre, contentLength: String(MAX_BODY_BYTES + 1) })?.status === 413, "حد الجسم 64 ك.ب بالترويسة (413)");
  throwsSync(() => parseBodyText("x".repeat(MAX_BODY_BYTES + 1)), "PAYLOAD_TOO_LARGE", "وحد الجسم بالطول الفعلي بالبايت");
  throwsSync(() => parseBodyText("{bad"), "INVALID_INPUT", "JSON غير صالح = 400 لا 500");
  ok(parseBodyText("") === null, "الجسم الفارغ = null");
  // الحارس نفسه (server-only لا يُستورد هنا): يمرّر isAuthDisabled() إلى الفحص الأول، وصفحات المكتب تُحوَّل.
  const guardSource = readFileSync(join(process.cwd(), "lib/modules/editorial/guard.ts"), "utf8");
  ok(
    guardSource.includes("authDisabled: isAuthDisabled()") && /requireEditorialPage[\s\S]*if \(isAuthDisabled\(\)\) redirect/.test(guardSource) && guardSource.includes('"Cache-Control": "no-store"'),
    "الحارس يرفض المكتب بالمصادقة المعطّلة في المسارات والصفحات، ويضع no-store",
  );
  const routeFiles = ["audit", "change-sets", "settings", "intake/amendments", "intake/principles", "systems/[id]"].map((r) =>
    readFileSync(join(process.cwd(), `app/api/admin/legal/${r}/route.ts`), "utf8"),
  );
  ok(routeFiles.every((src) => !src.includes("NextResponse.json(") && src.includes("deskJson")), "مسارات المكتب كلها تمر بـ deskJson (no-store)");

  // ق-١١ أم القرى
  ok(hijriToGregorian("1446-09-01") === "2025-03-01", "أم القرى: 1446-09-01 يقابل 2025-03-01");
  ok(hijriToGregorian("1446-15-35") === null, "أم القرى: 1446-15-35 غير موجود");
  ok(validateCorrection({ effective_from_hijri: "1446-09-01", effective_from_gregorian: "2025-03-01" }).effective_from_gregorian === "2025-03-01", "تصحيح بتاريخين متسقين يُقبل");
  throwsSync(() => validateCorrection({ effective_from_hijri: "1446-09-01", effective_from_gregorian: "2025-03-02" }), "INVALID_INPUT", "تصحيح بتاريخين غير متسقين يُرفض");
  throwsSync(() => validateCorrection({ effective_from_hijri: "1446-15-35" }), "INVALID_INPUT", "تصحيح بتاريخ هجري غير موجود يُرفض");
  ok(validateCorrection({ effective_from_hijri: "1446-9-1" }).effective_from_gregorian === undefined, "لا يُشتق الميلادي بصمت حين لا يُصحَّح");

  // ق-٤ مخطط الإعدادات
  const okCfg = editorialConfigSchema.safeParse(DEFAULT_EDITORIAL_CONFIG).success;
  ok(okCfg && DEFAULT_EDITORIAL_CONFIG.policies.set_work_status.minApprovals === 1 && DEFAULT_EDITORIAL_CONFIG.policies.set_work_status.ownerSelfApproval === true, "القيم الافتراضية تحفظ الأمر (1، واعتماد المالك الذاتي مسموح)");
  const withPolicy = (minApprovals: number) => ({ ...DEFAULT_EDITORIAL_CONFIG, policies: { ...DEFAULT_EDITORIAL_CONFIG.policies, revert: { minApprovals, ownerSelfApproval: true, enabled: true } } });
  ok(!editorialConfigSchema.safeParse(withPolicy(0)).success && !editorialConfigSchema.safeParse(withPolicy(6)).success && editorialConfigSchema.safeParse(withPolicy(5)).success, "minApprovals من 1 إلى 5 فقط");
  ok(!editorialConfigSchema.safeParse({ ...DEFAULT_EDITORIAL_CONFIG, bindings: [binding("x", ["reviewer"], "agent")] }).success, "الوكيل لا يُكلَّف بالاعتماد");
  ok(!editorialConfigSchema.safeParse({ ...DEFAULT_EDITORIAL_CONFIG, bindings: [binding("x", ["reviewer"]), binding("x", ["publisher"])] }).success, "تكليف واحد لكل مستخدم");

  // ق-٥ النطاق، وقراءة السجل والإعدادات
  const civilAccess = resolveEditorialAccess("LAWYER", binding("c", ["editor_laws", "reviewer"], "human", { domains: ["CIVIL"], itemKinds: ["set_work_status", "review_principle"] }));
  ok(inScope(civilAccess, "set_work_status", "CIVIL") && !inScope(civilAccess, "set_work_status", "LABOR"), "المجال يُطبَّق على ما له مجال");
  ok(inScope(civilAccess, "review_principle", ""), "وعناصر الاستقبال بلا مجال تُحكم بنوع العنصر وحده");
  ok(!inScope(civilAccess, "review_amendment_op", ""), "ونوع العنصر خارج التكليف يُرفض");
  ok(!resolveEditorialAccess("LAWYER", binding("d", ["reviewer"], "human", { enabled: false })).reviewer, "التكليف المعطّل لا يمنح شيئًا");
  ok(canManageSettings(owner) && !canManageSettings(reviewer), "الإعدادات للمالك وحده");
  ok(!canReadAudit(agent) && canReadAudit(reviewer) && canReadAudit(resolveEditorialAccess("TRAINEE", binding("q", ["qa_view"]))) && !canReadAudit(resolveEditorialAccess("LAWYER", binding("e", ["editor_laws"]))), "السجل لعرض الجودة أو المعتمِد، لا للوكيل ولا للمحرر وحده");

  // البصمة والسطر العربي
  const ch = { id: "b", target_type: "work", target_id: "S1", op: "set_work_status", before: { status: "ساري", x: 1 }, after: { status: "ملغى" }, evidence_instrument: "م/1", evidence_url: "https://uqn.gov.sa/x", evidence_quote: "نص", source_rank: 1, source_ref: null, domain: "" };
  const ch2 = { ...ch, id: "a", target_id: "S2" };
  ok(payloadHash({ id: "s", kind: "manual", reverts_change_set_id: null }, [ch, ch2]) === payloadHash({ id: "s", kind: "manual", reverts_change_set_id: null }, [ch2, { ...ch, before: { x: 1, status: "ساري" } }]), "بصمة الحمولة لا تتأثر بترتيب التغييرات ولا المفاتيح");
  ok(payloadHash({ id: "s", kind: "manual", reverts_change_set_id: null }, [ch]) !== payloadHash({ id: "s", kind: "manual", reverts_change_set_id: null }, [{ ...ch, after: { status: "مستبدل" } }]), "وتتغير بتغير الحمولة");
  const line = summarizeChange("manual", ch, "نظام المرافعات");
  ok(line === "حالة «نظام المرافعات»: ساري ← ملغى", "summary سطر عربي مقروء");
  ok(!summarizeChange("agent_review", { op: "review_amendment_op", target_id: "OP-1", before: {}, after: { decision: "approved_with_edit", corrected: { article_number: 2 } } }, "نظام").includes("{"), "summary قرار التعديل بلا JSON");
}

/** ق-٢: صفحة الأدوار وcanUser لا يمنحان LEGAL_* لغير المالك (بلا قاعدة: Prisma مستبدل بمحاكٍ). */
async function authTests() {
  console.log("\n— الصلاحيات العامة —");
  const roles: Record<string, string> = { own: "SUPER_ADMIN", sys: "SYSTEM_ADMIN", law: "LAWYER" };
  const fake = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => (roles[where.id] ? { role: roles[where.id] } : null) },
    // منح قديم في RolePermission لصلاحية مكتب وأخرى عامة: الأولى يجب ألا تُحترم.
    roleRecord: {
      findUnique: async ({ where }: { where: { key: string } }) => ({
        key: where.key,
        permissions: [{ permission: { key: "LEGAL_REVIEWER" } }, { permission: { key: "LEGAL_CORE_EDIT" } }],
      }),
    },
  };
  (globalThis as unknown as { prisma?: unknown }).prisma = fake;
  const { canUser } = await import("../lib/modules/auth/rbac");
  const { setRolePermission, buildBaselineMatrix, PERMISSION_CATALOG } = await import("../lib/modules/auth/role-admin");
  ok((await canUser("sys", "LEGAL_REVIEWER")) === false, "canUser(SYSTEM_ADMIN, LEGAL_REVIEWER) = false");
  ok((await canUser("law", "LEGAL_REVIEWER")) === false, "منح LEGAL_* القديم في RolePermission لا يُحترم");
  ok((await canUser("own", "LEGAL_PUBLISHER")) === true, "المالك يملك LEGAL_* ضمنًا");
  ok((await canUser("sys", "USERS_MANAGE")) === true && (await canUser("law", "LEGAL_CORE_EDIT")) === true && (await canUser("law", "USERS_MANAGE")) === false, "لا تغيير في غير LEGAL_* (التجاوز والمنح الإضافي كما كانا)");
  const refused = await setRolePermission("SYSTEM_ADMIN", "LEGAL_REVIEWER", true);
  ok(!refused.ok && Boolean(refused.message?.includes("/admin/legal/settings")), "صفحة الأدوار ترفض منح LEGAL_* (حتى لدور SYSTEM_ADMIN)");
  ok(!(await setRolePermission("LAWYER", "LEGAL_PUBLISHER", true)).ok && !(await setRolePermission("LAWYER", "LEGAL_REVIEWER", false)).ok, "ولا منح ولا سحب لأي LEGAL_*");
  ok(buildBaselineMatrix().every((r) => r.cells.every((cell) => !cell.permission.startsWith("LEGAL_EDITOR") && !["LEGAL_REVIEWER", "LEGAL_PUBLISHER", "LEGAL_QA_VIEW", "LEGAL_AGENT_PROPOSE"].includes(cell.permission))), "مصفوفة الأدوار بلا صلاحيات المكتب");
  ok(PERMISSION_CATALOG.some((p) => p.key === "LEGAL_PUBLISHER" && p.label.includes("ناشر")), "LEGAL_PUBLISHER بتسميته العربية");
  delete (globalThis as unknown as { prisma?: unknown }).prisma;
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

function binding(userId: string, roles: EditorialBinding["roles"], kind: "human" | "agent" = "human", extra: Partial<EditorialBinding> = {}): EditorialBinding {
  return { userId, kind, roles, itemKinds: "all", domains: "all", enabled: true, ...extra };
}

/** الخدمة تعيد بناء الفاعل من تكليفه في القاعدة داخل المعاملة؛ access هنا للاختبارات النقية وحدها. */
const actor = (id: string, role: string, roles: EditorialBinding["roles"] = [], kind: "human" | "agent" = "human"): EditorialActor => ({
  id,
  role,
  kind,
  agentName: kind === "agent" ? `user:${id}` : undefined,
  access: resolveEditorialAccess(role, roles.length || kind === "agent" ? binding(id, roles, kind) : null),
  // شرط التحقق الثنائي مفعّل افتراضيًّا: الفاعل البشري في الاختبارات متحقق، وحالاته الأخرى في اختبارات SW.
  mfa: kind === "human" ? true : null,
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
    ('u-plain-admin','مدير نظام','admin@test.local','SYSTEM_ADMIN'),
    ('agent-test','وكيل اختبار','agent@test.local','TRAINEE'),
    ('agent-other','وكيل آخر','agent2@test.local','TRAINEE')`);
  // التكليفات في إعدادات المكتب (المصدر الوحيد لصلاحيات المكتب)؛ كل تعديل نسخة جديدة.
  // يبني على آخر نسخة في القاعدة (قد تكون حُفظت بمسار الإعدادات الرسمي).
  const writeConfig = async (patch: (c: EditorialConfig) => void) => {
    const latest = (await pool.query(`SELECT version, config FROM editorial_config ORDER BY version DESC LIMIT 1`)).rows[0] as
      | { version: number; config: EditorialConfig }
      | undefined;
    const next: EditorialConfig = latest ? latest.config : JSON.parse(JSON.stringify(DEFAULT_EDITORIAL_CONFIG));
    patch(next);
    await pool.query(`INSERT INTO editorial_config (version, config, reason, actor_id) VALUES ($1, $2::jsonb, 'تكليف اختباري', 'u-owner')`, [
      (latest ? Number(latest.version) : 0) + 1,
      JSON.stringify(next),
    ]);
  };
  const setBinding = (b: EditorialBinding) =>
    writeConfig((c) => {
      c.bindings = [...c.bindings.filter((x) => x.userId !== b.userId), b];
    });
  await writeConfig((c) => {
    c.bindings = [
      binding("u-editor", ["editor_laws", "reviewer"]),
      binding("u-reviewer", ["reviewer", "publisher"]),
      binding("agent-test", ["editor_laws"], "agent"),
      binding("agent-other", ["editor_laws"], "agent"),
    ];
  });
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
  // HKM-028 (مراجعة الجودة م٤): «1 مكرر» وصف غير مادي بالرقم نفسه لا يحجبان النص الساري للأصل.
  await pool.query(
    `INSERT INTO legal_articles (id, "legalSystemId", "articleNumber", "articleBis", content, status)
     VALUES ('a1-bis','S1','1',1,'نص المادة الأولى مكرر','ساري'), ('a1-head','S1','1',100,'الباب الأول','ساري')`,
  );
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
  const editor = actor("u-editor", "SYSTEM_ADMIN", ["editor_laws", "reviewer"]);
  const reviewer = actor("u-reviewer", "LAWYER", ["reviewer", "publisher"]);
  const plainAdmin = actor("u-plain-admin", "SYSTEM_ADMIN");
  const agent = actor("agent-test", "TRAINEE", ["editor_laws"], "agent");

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
  await rejects(() => submitChangeSet(db, editor, "any"), "WRITE_DISABLED", "T0-5 إرسال دفعة بلا البوابة يُرفض");
  await rejects(() => decideChangeSet(db, reviewer, "any", { decision: "approve" }), "WRITE_DISABLED", "T0-5 قرار دفعة بلا البوابة يُرفض");
  await rejects(() => publishChangeSet(db, reviewer, "any"), "WRITE_DISABLED", "T0-5 نشر بلا البوابة يُرفض");
  await rejects(() => revertChangeSet(db, owner, "any", { reason: "اختبار" }), "WRITE_DISABLED", "T0-5 تراجع بلا البوابة يُرفض");
  await rejects(() => withdrawChangeSet(db, editor, "any", { reason: "اختبار" }), "WRITE_DISABLED", "T0-5 سحب بلا البوابة يُرفض");
  await rejects(() => bulkApproveAmendmentOps(db, reviewer, ["OP-A"]), "WRITE_DISABLED", "T0-5 اعتماد جماعي بلا البوابة يُرفض");
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
  const d03 = await rejects(
    () => createChangeSet(db, owner, { title: "ثان على S1", changes: [{ op: "set_work_status", targetId: "S1", status: "مستبدل", evidence: EVIDENCE("12") }] }),
    "OPEN_CHANGE_EXISTS",
    "D-03 تغيير ثانٍ على هدف مفتوح يُرفض",
  );
  ok(d03?.detail?.openChangeSetId === set1.changeSetId, "D-03 ويعيد معرّف الدفعة المفتوحة");
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

  // ── السحب وفك القفل ──
  console.log("\n— السحب —");
  await pool.query(`INSERT INTO legal_systems (id, name) VALUES ('S7', 'نظام اختبار S7'), ('S8', 'نظام اختبار S8')`);
  const draft7 = await createChangeSet(db, editor, {
    title: "مسودة مهملة",
    changes: [{ op: "set_work_status", targetId: "S8", status: "ملغى", evidence: EVIDENCE("81") }],
  });
  await rejects(() => withdrawChangeSet(db, reviewer, draft7.changeSetId, { reason: "ليس مُعِدّها" }), "FORBIDDEN", "لا يسحب المسودة غير مُعِدّها");
  const w = await withdrawChangeSet(db, editor, draft7.changeSetId, { reason: "مسودة مهملة" });
  ok(w.status === "rejected", "المُعِدّ يسحب مسودته فتصير مرفوضة");
  const again = await createChangeSet(db, editor, {
    title: "بعد السحب",
    changes: [{ op: "set_work_status", targetId: "S8", status: "ملغى", evidence: EVIDENCE("82") }],
  });
  ok(Boolean(again.changeSetId), "السحب فكّ قفل الهدف");
  ok((await num(`SELECT count(*) FROM audit_event WHERE action = 'change_set.withdraw'`)) === 1, "السحب مسجّل");
  await rejects(() => submitChangeSet(db, agent, agentSet3.changeSetId), "INVALID_STATE", "الدفعة المرسلة لا تُرسل ثانية");
  const otherAgent = actor("agent-other", "TRAINEE", ["editor_laws"], "agent");
  const agentDraft = await createChangeSet(db, agent, {
    title: "مسودة وكيل",
    changes: [{ op: "set_work_status", targetId: "S7", status: "ملغى", evidence: EVIDENCE("71") }],
  });
  await rejects(() => submitChangeSet(db, otherAgent, agentDraft.changeSetId), "FORBIDDEN", "وكيل لا يرسل دفعة وكيل آخر");
  await withdrawChangeSet(db, agent, agentDraft.changeSetId, { reason: "اختبار" });

  // سحب دور المعتمِد من المحرر يسري فورًا على الفعل التالي (يُبنى الفاعل من تكليفه داخل المعاملة).
  await setBinding(binding("u-editor", ["editor_laws"]));
  await rejects(() => withdrawChangeSet(db, editor, set3.changeSetId, { reason: "تعثّر النشر" }), "FORBIDDEN", "المُعِدّ غير المعتمِد لا يسحب دفعة اعتُمدت");
  await setBinding(binding("u-editor", ["editor_laws", "reviewer"]));
  const w3 = await withdrawChangeSet(db, reviewer, set3.changeSetId, { reason: "تعثّر النشر بتعارض" });
  ok(w3.status === "rejected", "المعتمِد يسحب الدفعة المعتمدة التي تعثّر نشرها");
  const afterW3 = await createChangeSet(db, editor, {
    title: "S3 بعد السحب",
    changes: [{ op: "set_work_status", targetId: "S3", status: "ملغى", evidence: EVIDENCE("34") }],
  });
  ok(Boolean(afterW3.changeSetId), "فكّ السحبُ قفل أهداف الدفعة المتعثرة");

  // ── التراجع لا يخترع سندًا ──
  console.log("\n— سند التراجع —");
  await pool.query(
    `INSERT INTO verification (id, object_type, object_id, verified_status, method, verified_at) VALUES ('v-S7-rule', 'work', 'S7', 'ساري', 'rule', NOW() - interval '10 days')`,
  );
  const set7 = await createChangeSet(db, editor, {
    title: "S7 بلا سند سابق كامل",
    changes: [{ op: "set_work_status", targetId: "S7", status: "ملغى", evidence: EVIDENCE("72") }],
  });
  await submitChangeSet(db, editor, set7.changeSetId);
  await decideChangeSet(db, reviewer, set7.changeSetId, { decision: "approve" });
  await publishChangeSet(db, reviewer, set7.changeSetId);
  const verBeforeRevert7 = await num(`SELECT count(*) FROM verification WHERE object_id = 'S7'`);
  await rejects(() => revertChangeSet(db, owner, set7.changeSetId, { reason: "اختبار", emergency: true }), "NO_PRIOR_STATUS", "التراجع يرفض إن كان السند السابق ناقصًا");
  ok((await num(`SELECT count(*) FROM verification WHERE object_id = 'S7'`)) === verBeforeRevert7, "ولم يُكتب صف بسند مخترع");

  // ── جولة مراجعة جديدة للمبدأ بعد إعادته ──
  console.log("\n— جولات المبدأ —");
  await decidePrinciple(db, reviewer, "P2", { decision: "reject", reason: "صياغة غير دقيقة" });
  await pool.query(`UPDATE judicial_principles SET "reviewStatus" = 'needs_review', "updatedAt" = NOW() + interval '1 second' WHERE id = 'P2'`);
  ok((await listPrincipleQueue(db)).items.some((i) => i.id === "P2"), "المبدأ المعاد إلى «يحتاج مراجعة» يظهر في الطابور");
  const round2 = await decidePrinciple(db, reviewer, "P2", { decision: "approve" });
  ok(round2.reviewStatus === "reviewed", "ويُقبل قرار الجولة الجديدة عليه");

  // ── حارس سلامة المخطط ──
  console.log("\n— سلامة المخطط —");
  ok((await checkDeskIntegrity(db)).ok, "الفهارس والمشغّلات كلها موجودة بعد الترحيل");
  await pool.query(`DROP INDEX editorial_change_open_target_uq`);
  const freshDb = pgEditorialDb(pool);
  const integrity = await checkDeskIntegrity(freshDb);
  ok(!integrity.ok && integrity.missing.includes("editorial_change_open_target_uq"), "غياب فهرس القفل يُكتشف");
  await rejects(
    () => createChangeSet(freshDb, editor, { title: "بلا قفل", changes: [{ op: "set_work_status", targetId: "S7", status: "ساري", evidence: EVIDENCE("73") }] }),
    "INVALID_STATE",
    "والكتابة تُقفل حتى يُستعاد",
  );
  await pool.query(readFileSync(join(root, "prisma/migrations/20261017090000_editorial_desk_phase0/migration.sql"), "utf8"));
  ok((await checkDeskIntegrity(freshDb)).ok, "إعادة تطبيق الترحيل تستعيد الحماية");

  const unifyCtx = { pool, db, one, num, setBinding, writeConfig, owner, editor, reviewer, agent, root };
  await unificationTests(unifyCtx);
  await round2Tests(unifyCtx);
  await qaFixTests(unifyCtx);
  await switchTests(unifyCtx);

  await pool.end();
}

// ── التوحيد مع #723 (HKM-023): اختبارات القسم ٦ من compare-architecture.md ───

interface UnifyCtx {
  pool: PgPoolLike;
  db: EditorialDb;
  one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;
  num: (sql: string, params?: unknown[]) => Promise<number>;
  setBinding: (b: EditorialBinding) => Promise<void>;
  writeConfig: (patch: (c: EditorialConfig) => void) => Promise<void>;
  owner: EditorialActor;
  editor: EditorialActor;
  reviewer: EditorialActor;
  agent: EditorialActor;
  root: string;
}

/** خطأ بشكل محرك الإنتاج: Prisma يلفّ رمز Postgres في meta.code تحت P2010 (لا في code). */
function prismaShapedError(code: string, message: string) {
  return Object.assign(new Error(`Raw query failed. Code: \`${code}\`. Message: \`${message}\``), {
    name: "PrismaClientKnownRequestError",
    code: "P2010",
    meta: { code, message },
    clientVersion: "5.22.0",
  });
}

/**
 * منفذ SQL يحاكي Prisma في الأخطاء: كل خطأ من pg يصل بشكل P2010 + meta.code،
 * ويمكن حقن خطأ داخل المعاملة لاستعلام بعينه، وإخفاء فحص القفل المسبق لمحاكاة السباق.
 */
function prismaShapedDb(pool: PgPoolLike, inject?: { match: RegExp; code: string; hideOpenCheck?: boolean }): EditorialDb {
  const convert = (error: unknown) => {
    const e = error as { code?: string; message?: string };
    return typeof e?.code === "string" && /^[0-9A-Z]{5}$/.test(e.code) ? prismaShapedError(e.code, e.message ?? "") : error;
  };
  const run = async (q: (sql: string, params?: readonly unknown[]) => Promise<PgResult>, sql: string, params: readonly unknown[], inTx: boolean) => {
    if (inTx && inject?.hideOpenCheck && sql.includes("SELECT change_set_id FROM editorial_change")) return [];
    if (inTx && inject && inject.match.test(sql)) throw prismaShapedError(inject.code, "injected");
    try {
      return (await q(sql, params as unknown[])).rows;
    } catch (error) {
      throw convert(error);
    }
  };
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => (await run((s, p) => pool.query(s, p), sql, params, false)) as T[],
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: async <T>(sql: string, params: readonly unknown[] = []) => (await run((s, p) => client.query(s, p), sql, params, true)) as T[] });
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

async function unificationTests(c: UnifyCtx) {
  const { pool, db, one, num, setBinding, writeConfig, owner, editor, reviewer, agent } = c;
  const latestVersion = async () => num(`SELECT coalesce(max(version), 0) FROM editorial_config`);
  const latestStatus = async (id: string) =>
    (await one<{ verified_status: string }>(`SELECT verified_status FROM verification WHERE object_type = 'work' AND object_id = $1 ORDER BY verified_at DESC, id DESC LIMIT 1`, [id])).verified_status;
  const publishable = async (title: string, targetId: string, status: "ملغى" | "مستبدل" | "ساري", n: string, by = editor) => {
    const s = await createChangeSet(db, by, { title, changes: [{ op: "set_work_status", targetId, status, evidence: EVIDENCE(n) }] });
    await submitChangeSet(db, by, s.changeSetId);
    return s.changeSetId;
  };

  await pool.query(`INSERT INTO users (id, name, email, role) VALUES
    ('u-reviewer2','معتمد ثان','reviewer2@test.local','JUDGE'),
    ('u-qa','جودة','qa@test.local','TRAINEE'),
    ('u-civil','محرر مدني','civil@test.local','LAWYER'),
    ('u-kind','معتمد مبادئ','kind@test.local','LAWYER'),
    ('u-outsider','بلا تكليف','outsider@test.local','LAWYER')`);
  for (const [id, domain] of [["U1", null], ["U2", null], ["U3", null], ["U4", null], ["U5", null], ["U6", null], ["U7", null], ["U9", "CIVIL"], ["U10", "LABOR"]] as const) {
    await pool.query(`INSERT INTO legal_systems (id, name, domain) VALUES ($1, $2, $3)`, [id, `نظام التوحيد ${id}`, domain]);
    await pool.query(
      `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_at)
       VALUES ($1, 'work', $2, 'ساري', 'المرسوم الملكي رقم م/1', 'https://uqn.gov.sa/details?p=1', 'يعمل بهذا النظام من تاريخ نشره في الجريدة الرسمية.', 'manual', NOW() - interval '30 days')`,
      [`v-${id}`, id],
    );
  }
  await setBinding(binding("u-reviewer2", ["reviewer", "publisher"]));
  await setBinding(binding("u-qa", ["qa_view"]));
  await setBinding(binding("u-civil", ["editor_laws"], "human", { domains: ["CIVIL"] }));
  await setBinding(binding("u-kind", ["reviewer"], "human", { itemKinds: ["review_principle"] }));
  const reviewer2 = actor("u-reviewer2", "JUDGE", ["reviewer", "publisher"]);
  const qa = actor("u-qa", "TRAINEE", ["qa_view"]);
  // access هنا يطابق تكليفه في القاعدة (القراءات تستعمل access الممرَّر كما يبنيه الحارس).
  const civil: EditorialActor = { ...actor("u-civil", "LAWYER"), access: resolveEditorialAccess("LAWYER", binding("u-civil", ["editor_laws"], "human", { domains: ["CIVIL"] })) };
  const kindOnly = actor("u-kind", "LAWYER", ["reviewer"]);
  const outsider = actor("u-outsider", "LAWYER");

  // ── أمن الصلاحيات (ق-٢، ق-١٢) ──
  console.log("\n— التوحيد: الصلاحيات والسجل —");
  await rejects(() => listAudit(db, agent, {}), "FORBIDDEN", "ق-١٢ الوكيل لا يقرأ سجل التدقيق");
  await rejects(() => listAudit(db, civil, {}), "FORBIDDEN", "ق-١٢ المحرر بلا عرض الجودة لا يقرأ السجل");
  ok((await listAudit(db, qa, { limit: 5 })).length > 0, "ق-١٢ صاحب عرض الجودة يقرأ السجل");
  ok((await listAudit(db, reviewer, { limit: 5 })).length > 0, "ق-١٢ المعتمِد يقرأ السجل");

  // ── النطاق (ق-٥) ──
  console.log("\n— التوحيد: النطاق —");
  await rejects(
    () => createChangeSet(db, civil, { title: "خارج المجال", changes: [{ op: "set_work_status", targetId: "U10", status: "ملغى", evidence: EVIDENCE("901") }] }),
    "FORBIDDEN",
    "ق-٥ المحرر المقيّد بمجال «مدني» لا يحرر نظامًا من مجال آخر",
  );
  const civilSet = await createChangeSet(db, civil, { title: "داخل المجال", changes: [{ op: "set_work_status", targetId: "U9", status: "ملغى", evidence: EVIDENCE("902") }] });
  ok(Boolean(civilSet.changeSetId), "ق-٥ ويحرر نظامًا من مجاله");
  ok((await one<{ domain: string }>(`SELECT domain FROM editorial_change WHERE change_set_id = $1`, [civilSet.changeSetId])).domain === "CIVIL", "مجال الهدف محفوظ في التغيير");
  await submitChangeSet(db, civil, civilSet.changeSetId);
  await rejects(() => decideChangeSet(db, kindOnly, civilSet.changeSetId, { decision: "approve" }), "FORBIDDEN", "ق-٥ المعتمِد المقيّد بالمبادئ لا يعتمد حالة نظام");
  const laborSet = await createChangeSet(db, editor, { title: "مجال العمل", changes: [{ op: "set_work_status", targetId: "U10", status: "ملغى", evidence: EVIDENCE("9021") }] });
  const civilViews = await listChangeSetsDetailed(db, civil, { status: "open" });
  ok(civilViews.some((v) => v.id === civilSet.changeSetId) && !civilViews.some((v) => v.id === laborSet.changeSetId), "يرى المقيّد بمجال دفعاته وما في نطاقه، لا دفعات مجال آخر");
  ok((await listChangeSetsDetailed(db, owner, { status: "open" })).some((v) => v.id === laborSet.changeSetId), "والمالك يرى الكل");
  await withdrawChangeSet(db, civil, civilSet.changeSetId, { reason: "تنظيف" });
  await withdrawChangeSet(db, editor, laborSet.changeSetId, { reason: "تنظيف" });

  // ── الناشر منفصل عن المعتمِد (ق-٣) ──
  console.log("\n— التوحيد: النشر والموافقات —");
  const pubSet = await publishable("فصل النشر", "U1", "ملغى", "903");
  await decideChangeSet(db, reviewer2, pubSet, { decision: "approve" });
  await rejects(() => publishChangeSet(db, editor, pubSet), "FORBIDDEN", "ق-٣ المعتمِد بلا دور الناشر لا ينشر");
  await publishChangeSet(db, reviewer2, pubSet);
  ok((await latestStatus("U1")) === "ملغى", "الناشر في نطاقه ينشر");

  // ── اعتمادان مطلوبان (من #723) ──
  await writeConfig((cfg) => {
    cfg.policies.set_work_status.minApprovals = 2;
  });
  const two = await publishable("موافقتان", "U2", "ملغى", "904");
  const d1 = await decideChangeSet(db, reviewer, two, { decision: "approve" });
  ok(d1.status === "pending" && d1.approvals === 1 && d1.requiredApprovals === 2, "اعتمادان مطلوبان: الأول يُبقي الدفعة في الطابور (1 من 2)");
  await rejects(() => publishChangeSet(db, reviewer2, two), "INVALID_STATE", "والنشر يُرفض قبل اكتمال الموافقات");
  await rejects(() => decideChangeSet(db, reviewer, two, { decision: "approve" }), "ALREADY_DECIDED", "المعتمِد نفسه لا يُعدّ مرتين (UNIQUE)");
  const d2 = await decideChangeSet(db, reviewer2, two, { decision: "approve" });
  ok(d2.status === "approved" && d2.approvals === 2, "والثاني يكمل الاعتماد");
  await publishChangeSet(db, reviewer2, two);
  ok((await latestStatus("U2")) === "ملغى", "ثم يُنشر");

  // ── سحب التكليف فوري: يُعاد عدّ الموافقات عند النشر بالصلاحية الحالية ──
  const revoked = await publishable("سحب قبل النشر", "U3", "ملغى", "905");
  await decideChangeSet(db, reviewer, revoked, { decision: "approve" });
  await decideChangeSet(db, reviewer2, revoked, { decision: "approve" });
  await setBinding(binding("u-reviewer", ["publisher"]));
  const e8 = await rejects(() => publishChangeSet(db, reviewer2, revoked), "INVALID_STATE", "سحب تكليف معتمِد يُسقط موافقته فورًا عند النشر");
  ok(e8?.detail?.approvals === 1 && e8?.detail?.required === 2, "التفصيل: موافقة صالحة واحدة من اثنتين");
  const pend2 = await publishable("سحب ثم قرار", "U6", "ملغى", "9051");
  await rejects(() => decideChangeSet(db, reviewer, pend2, { decision: "approve" }), "FORBIDDEN", "ومن سُحب تكليفه لا يقرّر");
  await withdrawChangeSet(db, editor, pend2, { reason: "تنظيف" });
  await setBinding(binding("u-reviewer", ["reviewer", "publisher"]));
  await withdrawChangeSet(db, reviewer2, revoked, { reason: "تعثّر النشر بعد سحب تكليف" });

  // ── ownerSelfApproval=false ──
  await writeConfig((cfg) => {
    cfg.policies.set_work_status = { minApprovals: 1, ownerSelfApproval: false, enabled: true };
  });
  const ownSet = await publishable("المالك بلا اعتماد ذاتي", "U4", "ملغى", "906", owner);
  await rejects(() => decideChangeSet(db, owner, ownSet, { decision: "approve", reason: "سبب مكتوب" }), "SELF_APPROVAL_FORBIDDEN", "سياسة ownerSelfApproval=false تمنع اعتماد المالك الذاتي");
  await decideChangeSet(db, reviewer, ownSet, { decision: "approve" });
  await publishChangeSet(db, reviewer, ownSet);

  // ── مسار معطّل، والتراجع العاجل لا يُعطَّل ──
  await writeConfig((cfg) => {
    cfg.policies.set_work_status = { minApprovals: 1, ownerSelfApproval: true, enabled: false };
    cfg.policies.revert = { minApprovals: 1, ownerSelfApproval: true, enabled: false };
  });
  await rejects(
    () => createChangeSet(db, editor, { title: "مسار معطّل", changes: [{ op: "set_work_status", targetId: "U5", status: "ملغى", evidence: EVIDENCE("907") }] }),
    "FORBIDDEN",
    "ق-٤ المسار المعطّل في السياسات يرفض الإنشاء",
  );
  await rejects(() => revertChangeSet(db, reviewer, ownSet, { reason: "مسار التراجع معطّل" }), "FORBIDDEN", "والتراجع العادي يُرفض حين يُعطَّل مساره");
  const urgent = await revertChangeSet(db, owner, ownSet, { reason: "عاجل رغم السياسة", emergency: true });
  ok(urgent.status === "published", "ق-٤ التراجع العاجل للمالك متاح دائمًا ولا يُعطَّل بسياسة");
  await writeConfig((cfg) => {
    cfg.policies.set_work_status = { minApprovals: 1, ownerSelfApproval: true, enabled: true };
    cfg.policies.revert = { minApprovals: 1, ownerSelfApproval: true, enabled: true };
  });

  // ── التراجع عن A بعد نشر B يعطي CONFLICT (P1) ──
  console.log("\n— التوحيد: التراجع —");
  const A = await publishable("A إلغاء", "U5", "ملغى", "908");
  await decideChangeSet(db, reviewer, A, { decision: "approve" });
  await publishChangeSet(db, reviewer, A);
  const B = await publishable("B استبدال", "U5", "مستبدل", "909");
  await decideChangeSet(db, reviewer, B, { decision: "approve" });
  await publishChangeSet(db, reviewer, B);
  const verBeforeP1 = await num(`SELECT count(*) FROM verification WHERE object_id = 'U5'`);
  const p1 = await rejects(() => revertChangeSet(db, reviewer, A, { reason: "تراجع عن القديمة" }), "CONFLICT", "P1 التراجع عن A بعد نشر B يُرفض");
  ok(Boolean(p1?.message.includes("تغيّرت حالة الهدف بعد نشر هذه الدفعة")), "P1 برسالة «تغيّرت حالة الهدف بعد نشر هذه الدفعة…»");
  await rejects(() => revertChangeSet(db, owner, A, { reason: "عاجل", emergency: true }), "CONFLICT", "P1 والتراجع العاجل كذلك");
  ok((await num(`SELECT count(*) FROM verification WHERE object_id = 'U5'`)) === verBeforeP1 && (await latestStatus("U5")) === "مستبدل", "P1 لم يُكتب فوق B شيء");
  const revB = await revertChangeSet(db, reviewer, B, { reason: "التراجع عن الأحدث" });
  ok(revB.status === "draft", "التراجع عن B (الحالية) مسموح");
  await withdrawChangeSet(db, reviewer, revB.revertChangeSetId, { reason: "تنظيف" });

  // ── NOT_REVERTIBLE لقرارات المقترحات ──
  const intakeSet = (await one<{ id: string }>(`SELECT id FROM change_set WHERE kind = 'agent_review' AND status = 'published' ORDER BY created_at LIMIT 1`)).id;
  const nr = await rejects(() => revertChangeSet(db, owner, intakeSet, { reason: "تراجع عن قرار مقترح", emergency: true }), "NOT_REVERTIBLE", "ق-٧ دفعة قرار مقترح لا يُتراجع عنها");
  ok(nr?.status === 409, "NOT_REVERTIBLE برمز 409");

  // ── OPEN_CHANGE_EXISTS يعيد معرّف المفتوح ──
  const openSet = await createChangeSet(db, editor, { title: "مفتوح", changes: [{ op: "set_work_status", targetId: "U6", status: "ملغى", evidence: EVIDENCE("910") }] });
  const oe = await rejects(
    () => createChangeSet(db, owner, { title: "ثان", changes: [{ op: "set_work_status", targetId: "U6", status: "مستبدل", evidence: EVIDENCE("911") }] }),
    "OPEN_CHANGE_EXISTS",
    "D-03 القفل على U6",
  );
  ok(oe?.detail?.openChangeSetId === openSet.changeSetId, "OPEN_CHANGE_EXISTS يعيد detail.openChangeSetId");

  // ── ثبات الدفعة (P4) والبصمة ──
  console.log("\n— التوحيد: ثبات الحمولة —");
  const sealed = await publishable("P4 دفعة", "U7", "ملغى", "912");
  await decideChangeSet(db, reviewer, sealed, { decision: "approve" });
  const tryQ = async (sql: string, params: unknown[] = []) => {
    try {
      await pool.query(sql, params);
      return false;
    } catch {
      return true;
    }
  };
  ok(
    await tryQ(
      `INSERT INTO editorial_change (id, change_set_id, target_type, target_id, op, before, after, evidence_instrument, evidence_url, evidence_quote, author_id, author_kind, status)
       VALUES ('inj', $1, 'work', 'U1', 'set_work_status', '{}'::jsonb, '{"status":"ملغى"}'::jsonb, 'x', 'https://uqn.gov.sa/y', 'سند محقون طويل بما يكفي', 'u-editor', 'human', 'approved')`,
      [sealed],
    ),
    "P4 الإدراج في دفعة معتمدة يُرفض من القاعدة",
  );
  ok(await tryQ(`UPDATE change_set SET payload_hash = 'x' WHERE id = $1`, [sealed]), "بصمة الدفعة مجمّدة بعد ضبطها");
  ok(await tryQ(`UPDATE editorial_change SET applied_ref = 'x' WHERE id = (SELECT id FROM editorial_change WHERE applied_ref IS NOT NULL LIMIT 1)`), "applied_ref لا يتغير بعد ضبطه");
  // تجاوز الحماية بصلاحية مالك القاعدة: النشر يعيد حساب البصمة من الصفوف فيكشفه.
  await pool.query(`ALTER TABLE editorial_change DISABLE TRIGGER editorial_change_guard`);
  await pool.query(`UPDATE editorial_change SET after = '{"status":"مستبدل"}'::jsonb WHERE change_set_id = $1`, [sealed]);
  await pool.query(`ALTER TABLE editorial_change ENABLE TRIGGER editorial_change_guard`);
  await rejects(() => publishChangeSet(db, reviewer, sealed), "CONFLICT", "النشر يعيد حساب البصمة ويرفض حمولة غُيّرت بعد الاعتماد");
  ok((await latestStatus("U7")) === "ساري", "ولم يُنشر شيء");
  await withdrawChangeSet(db, reviewer, sealed, { reason: "حمولة مغيّرة" });

  // ── فشل مصطنع على الصف الثالث وقت النشر (T0-3b، من #723) ──
  const t3 = await createChangeSet(db, editor, {
    title: "ثلاثة بفشل مصطنع",
    changes: [
      { op: "set_work_status", targetId: "U3", status: "ملغى", evidence: EVIDENCE("913") },
      { op: "set_work_status", targetId: "U4", status: "مستبدل", evidence: EVIDENCE("914") },
      { op: "set_work_status", targetId: "U6", status: "ملغى", evidence: EVIDENCE("915") },
    ],
  }).catch((error) => error);
  // U6 مقفل بدفعة مفتوحة؛ نسحبها ثم نعيد.
  ok(t3 instanceof EditorialError && t3.code === "OPEN_CHANGE_EXISTS", "قفل الهدف يشمل الدفعة متعددة الأهداف");
  await withdrawChangeSet(db, editor, openSet.changeSetId, { reason: "فك القفل" });
  const t3b = await createChangeSet(db, editor, {
    title: "ثلاثة بفشل مصطنع",
    changes: [
      { op: "set_work_status", targetId: "U3", status: "ملغى", evidence: EVIDENCE("913") },
      { op: "set_work_status", targetId: "U4", status: "مستبدل", evidence: EVIDENCE("914") },
      { op: "set_work_status", targetId: "U6", status: "ملغى", evidence: EVIDENCE("915") },
    ],
  });
  await submitChangeSet(db, editor, t3b.changeSetId);
  await decideChangeSet(db, reviewer, t3b.changeSetId, { decision: "approve" });
  const order = await pool.query(`SELECT target_id FROM editorial_change WHERE change_set_id = $1 ORDER BY created_at, id`, [t3b.changeSetId]);
  const third = String(order.rows[2].target_id);
  await pool.query(`CREATE OR REPLACE FUNCTION test_fail_third() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN IF NEW.object_id = '${third}' THEN RAISE EXCEPTION 'فشل مصطنع'; END IF; RETURN NEW; END; $f$`);
  await pool.query(`CREATE TRIGGER test_fail_third BEFORE INSERT ON verification FOR EACH ROW EXECUTE FUNCTION test_fail_third()`);
  const verBefore3b = await num(`SELECT count(*) FROM verification`);
  let failed3b = false;
  try {
    await publishChangeSet(db, reviewer, t3b.changeSetId);
  } catch {
    failed3b = true;
  }
  ok(failed3b, "T0-3b فشل القاعدة في الصف الثالث يوقف النشر");
  ok((await num(`SELECT count(*) FROM verification`)) === verBefore3b, "T0-3b ولم يُكتب صف سند للصفين الأولين");
  ok((await num(`SELECT count(*) FROM editorial_change WHERE change_set_id = $1 AND applied_ref IS NOT NULL`, [t3b.changeSetId])) === 0, "T0-3b ولا مرجع نشر");
  await pool.query(`DROP TRIGGER test_fail_third ON verification`);
  await publishChangeSet(db, reviewer, t3b.changeSetId);
  ok((await num(`SELECT count(*) FROM editorial_change WHERE change_set_id = $1 AND applied_ref IS NOT NULL`, [t3b.changeSetId])) === 3, "بعد زوال الفشل يُنشر الكل ويُسجَّل مرجع كل تغيير");

  // ── أداة واحدة لنظامين (G5) ورتبة المصدر من الرابط (G6) ──
  console.log("\n— التوحيد: السند —");
  const sameEvidence = { instrument: "المرسوم الملكي رقم م/77", url: "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/77", quote: "يُلغى النظامان المذكوران ويحل محلهما هذا النظام." };
  // رتبة يرسلها العميل تُتجاهل: الخادم يشتقها من الرابط.
  const withClientRank = (targetId: string) => ({ op: "set_work_status", targetId, status: "مستبدل", evidence: sameEvidence, sourceRank: 1 }) as unknown as ChangeInput;
  const g5 = await createChangeSet(db, editor, { title: "أداة واحدة تلغي نظامين", changes: [withClientRank("U1"), withClientRank("U2")] });
  ok(g5.changeIds.length === 2, "G5 دفعة أداة واحدة لنظامين تُقبل");
  const ranks = await pool.query(`SELECT DISTINCT source_rank FROM editorial_change WHERE change_set_id = $1`, [g5.changeSetId]);
  ok(ranks.rows.length === 1 && Number(ranks.rows[0].source_rank) === 2, "G6 رتبة المصدر مشتقة من الرابط (هيئة الخبراء = 2) لا من العميل");
  await submitChangeSet(db, editor, g5.changeSetId);
  await decideChangeSet(db, reviewer, g5.changeSetId, { decision: "approve" });
  ok((await publishChangeSet(db, reviewer, g5.changeSetId)).published === 2, "G5 وتُنشر");

  // ── مفتاح التكرار ──
  const idem1 = await createChangeSet(db, editor, { title: "بمفتاح", idempotencyKey: "k-1", changes: [{ op: "set_work_status", targetId: "U9", status: "ملغى", evidence: EVIDENCE("916") }] });
  const idem2 = await createChangeSet(db, editor, { title: "بمفتاح", idempotencyKey: "k-1", changes: [{ op: "set_work_status", targetId: "U9", status: "ملغى", evidence: EVIDENCE("916") }] });
  ok(idem2.changeSetId === idem1.changeSetId && idem2.replayed === true, "تكرار الطلب بمفتاحه يعيد الدفعة نفسها");
  await rejects(
    () => createChangeSet(db, owner, { title: "مفتاح غيره", idempotencyKey: "k-1", changes: [{ op: "set_work_status", targetId: "U10", status: "ملغى", evidence: EVIDENCE("917") }] }),
    "CONFLICT",
    "ومفتاح دفعة مؤلف آخر يُرفض",
  );
  await withdrawChangeSet(db, editor, idem1.changeSetId, { reason: "تنظيف" });

  // ── الإعدادات (ق-٢) ──
  console.log("\n— التوحيد: الإعدادات —");
  await rejects(() => readEditorialSettings(db, editor), "FORBIDDEN", "قراءة الإعدادات من غير المالك 403");
  const view = await readEditorialSettings(db, owner);
  ok(view.version === (await latestVersion()) && view.users.some((u) => u.id === "u-reviewer"), "المالك يقرأ آخر نسخة والمستخدمين");
  const base = view.version;
  const cfg = JSON.parse(JSON.stringify(view.config)) as EditorialConfig;
  await rejects(() => saveEditorialSettings(db, editor, { baseVersion: base, reason: "محاولة تعديل", config: cfg }), "FORBIDDEN", "حفظ الإعدادات من غير المالك 403");
  await rejects(() => saveEditorialSettings(db, owner, { baseVersion: base, reason: "قصر", config: cfg }), "REASON_REQUIRED", "السبب إلزامي (خمسة أحرف على الأقل)");
  const bad = (patch: (x: EditorialConfig) => void) => {
    const x = JSON.parse(JSON.stringify(cfg)) as EditorialConfig;
    patch(x);
    return x;
  };
  await rejects(() => saveEditorialSettings(db, owner, { baseVersion: base, reason: "حد مرتفع", config: bad((x) => (x.policies.revert.minApprovals = 6)) }), "INVALID_INPUT", "minApprovals = 6 يُرفض");
  await rejects(() => saveEditorialSettings(db, owner, { baseVersion: base, reason: "حد صفري", config: bad((x) => (x.policies.revert.minApprovals = 0)) }), "INVALID_INPUT", "minApprovals = 0 يُرفض");
  await rejects(
    () => saveEditorialSettings(db, owner, { baseVersion: base, reason: "المالك وكيلًا", config: bad((x) => x.bindings.push(binding("u-owner", ["editor_laws"], "agent"))) }),
    "INVALID_INPUT",
    "تكليف المالك وكيلًا يُرفض",
  );
  await rejects(
    () =>
      saveEditorialSettings(db, owner, {
        baseVersion: base,
        reason: "وكيل معتمد",
        config: bad((x) => {
          x.bindings = x.bindings.map((b) => (b.userId === "agent-test" ? { ...b, roles: ["editor_laws", "reviewer"] } : b));
        }),
      }),
    "INVALID_INPUT",
    "تكليف الوكيل بالاعتماد يُرفض",
  );
  await rejects(
    () => saveEditorialSettings(db, owner, { baseVersion: base, reason: "مستخدم مجهول", config: bad((x) => x.bindings.push(binding("u-ghost", ["reviewer"]))) }),
    "INVALID_INPUT",
    "تكليف مستخدم غير موجود يُرفض",
  );
  const flip = bad((x) => {
    x.bindings = x.bindings.map((b) => (b.userId === "agent-other" ? { ...b, kind: "human" as const, roles: ["editor_laws"] } : b));
  });
  await rejects(() => saveEditorialSettings(db, reviewer, { baseVersion: base, reason: "قلب وكيل إلى بشري", config: flip }), "FORBIDDEN", "قلب الوكيل إلى بشري من غير المالك يُرفض");
  const saved = await saveEditorialSettings(db, owner, { baseVersion: base, reason: "قلب وكيل إلى بشري بقرار المالك", config: flip });
  ok(saved.version === base + 1, "المالك يحفظ نسخة جديدة برقم يلي الأساس");
  ok(
    (await num(`SELECT count(*) FROM audit_event WHERE action = 'config.save' AND object_id = $1 AND detail->'agentToHuman' ? 'agent-other'`, [String(saved.version)])) === 1,
    "الحفظ مسجّل في audit_event مع قلب الوكيل",
  );
  const stale = await rejects(() => saveEditorialSettings(db, owner, { baseVersion: base, reason: "نسخة قديمة", config: cfg }), "CONFLICT", "تعارض رقم النسخة يُرفض");
  ok(stale?.status === 409 && stale?.detail?.currentVersion === saved.version, "برمز 409 ومعه النسخة الحالية");
  ok(await tryQ(`UPDATE editorial_config SET reason = 'x'`), "نسخ الإعدادات لا تُعدَّل");
  // سحب فوري عبر الحفظ الرسمي: المعتمِد الثاني يفقد الاعتماد في الفعل التالي.
  const cur = await readEditorialSettings(db, owner);
  const revokeCfg = JSON.parse(JSON.stringify(cur.config)) as EditorialConfig;
  revokeCfg.bindings = revokeCfg.bindings.map((b) => (b.userId === "u-reviewer2" ? { ...b, enabled: false } : b));
  const pend = await publishable("بعد السحب", "U10", "ملغى", "918", owner);
  await saveEditorialSettings(db, owner, { baseVersion: cur.version, reason: "سحب تكليف المعتمد الثاني", config: revokeCfg });
  await rejects(() => decideChangeSet(db, reviewer2, pend, { decision: "approve" }), "FORBIDDEN", "سحب التكليف بالحفظ يسري فورًا على الفعل التالي");
  await withdrawChangeSet(db, owner, pend, { reason: "تنظيف" });
  const restore = await readEditorialSettings(db, owner);
  restore.config.bindings = restore.config.bindings.map((b) => (b.userId === "u-reviewer2" ? { ...b, enabled: true } : b));
  await saveEditorialSettings(db, owner, { baseVersion: restore.version, reason: "إعادة تكليف المعتمد الثاني", config: restore.config });

  // ── الاستقبال بتعدد الموافقات (ق-٦) ──
  console.log("\n— التوحيد: الاستقبال —");
  const addOp = (id: string, extra: { article?: number | null; code?: string; confidence?: string } = {}) =>
    pool.query(
      `INSERT INTO uqn_fix.amendment_op (op_id, effect_id, instrument_kind, instrument_no, source_url, target_law_title, target_hakeem_code,
          target_resolution, op_type, article_number, new_text, risks, confidence, verbatim_in_source, evidence_quote, raw)
       VALUES ($1, 'E1', 'royal_decree', 'م/9', 'https://uqn.gov.sa/details?p=9', 'نظام اختبار S1', $2, 'hakeem_reference_code',
               'replace_article_text', $3, 'نص جديد', '{}'::text[], $4, TRUE, 'تعدل المادة الأولى لتكون بالنص الآتي', '{}'::jsonb)`,
      [id, extra.code ?? "S1", extra.article === undefined ? 1 : extra.article, extra.confidence ?? "rule_exact"],
    );
  for (const id of ["OP-E", "OP-F", "OP-G"]) await addOp(id);
  await addOp("OP-H", { article: 99, confidence: "needs_review" });
  await addOp("OP-I", { code: "NO-SUCH", confidence: "needs_review" });
  await pool.query(`INSERT INTO judicial_principles (id, title, "principleText", "sourceCaseId", "reviewStatus") VALUES ('P4','مبدأ رابع','نص المبدأ الرابع','c1','needs_review')`);

  // النص الساري للمادة المستهدفة
  await pool.query(`INSERT INTO unit_version (id, unit_id, body, valid_from) VALUES ('uv2','a1','نص المادة الأولى بعد تعديل سابق', NOW() - interval '1 day')`);
  await pool.query(`INSERT INTO unit_version (id, unit_id, body, valid_from) VALUES ('uv3','a1','نص لم يسرِ بعد', NOW() + interval '30 days')`);
  const q = await listAmendmentQueue(db, { limit: 100 }, reviewer);
  const itemE = q.items.find((i) => i.op_id === "OP-E");
  ok(itemE?.current_text === "نص المادة الأولى بعد تعديل سابق" && itemE.current_text_resolved === true, "current_text = النسخة السارية اليوم من unit_version");
  ok(itemE?.current_text === "نص المادة الأولى بعد تعديل سابق", "current_text للأصل رغم وجود «مكرر» وصف غير مادي بالرقم نفسه (articleBis)");
  const itemH = q.items.find((i) => i.op_id === "OP-H");
  const itemI = q.items.find((i) => i.op_id === "OP-I");
  ok(itemH?.current_text === null && itemH.current_text_resolved === false, "مادة غير موجودة = null وcurrent_text_resolved=false (لا تخمين)");
  ok(itemI?.current_text === null && itemI.current_text_resolved === false, "نظام غير محلول = null");
  ok(itemE?.pending_approvals === 0 && itemE.required_approvals === 1 && itemE.my_approval === false, "حقول الموافقات المعلّقة بلا مقترح");

  await writeConfig((cfg2) => {
    cfg2.policies.review_amendment_op.minApprovals = 2;
    cfg2.policies.review_principle.minApprovals = 2;
  });
  const reviewsBefore = await num(`SELECT count(*) FROM uqn_fix.amendment_review`);
  const e1 = await decideAmendmentOp(db, reviewer, "OP-E", { decision: "approved", note: "مطابق" });
  ok(e1.status === "pending" && e1.approvals === 1 && e1.requiredApprovals === 2, "ق-٦ أول موافقة تفتح مقترحًا معلّقًا (1 من 2)");
  ok((await num(`SELECT count(*) FROM uqn_fix.amendment_review`)) === reviewsBefore, "ولا يُكتب شيء في المصدر قبل الاكتمال");
  // ملحق الجولة الثانية: ما وافق عليه المشاهد وينتظر غيره في عرض waiting_others لا في mine.
  const qPending = await listAmendmentQueue(db, { limit: 100, view: "waiting_others" }, reviewer);
  const pendingE = qPending.items.find((i) => i.op_id === "OP-E");
  ok(pendingE?.pending_approvals === 1 && pendingE.required_approvals === 2 && pendingE.my_approval === true && pendingE.pending_change_set_id === e1.changeSetId, "العنصر يبقى في الطابور بحقول المقترح المعلّق");
  ok((await listAmendmentQueue(db, { limit: 100 }, reviewer2)).items.find((i) => i.op_id === "OP-E")?.my_approval === false, "my_approval لكل مشاهد");
  const hE = e1.decisionHash;
  await rejects(() => decideAmendmentOp(db, reviewer, "OP-E", { decision: "approved", expectedDecisionHash: hE }), "ALREADY_DECIDED", "المعتمِد نفسه لا يوافق مرتين");
  const ce = await rejects(
    () => decideAmendmentOp(db, reviewer2, "OP-E", { decision: "approved_with_edit", corrected: { article_number: 2 }, note: "تصحيح", expectedDecisionHash: hE }),
    "CONFLICT",
    "الموافقات اللاحقة على القرار نفسه فقط",
  );
  ok(ce?.detail?.openChangeSetId === e1.changeSetId, "والتعارض يعيد معرّف المقترح المعلّق");
  await rejects(() => decideAmendmentOp(db, agent, "OP-E", { decision: "approved" }), "AGENT_CANNOT_DECIDE", "الوكيل لا يصوّت");
  const e2 = await decideAmendmentOp(db, reviewer2, "OP-E", { decision: "approved", note: "موافق أيضًا", expectedDecisionHash: hE });
  ok(e2.status === "published" && e2.approvals === 2, "الموافقة الثانية على القرار نفسه تكمله");
  const rowE = await one<{ decision: string; reviewer: string }>(`SELECT decision, reviewer FROM uqn_fix.amendment_review WHERE op_id = 'OP-E'`);
  ok(rowE.decision === "approved" && rowE.reviewer === "u-reviewer+u-reviewer2", "ويُكتب القرار في المصدر صفًّا واحدًا باسم المعتمِدَين");

  const f1 = await decideAmendmentOp(db, reviewer, "OP-F", { decision: "approved" });
  const fr = await decideAmendmentOp(db, reviewer2, "OP-F", { decision: "rejected", note: "النص لا يطابق الأداة", expectedDecisionHash: f1.decisionHash });
  ok(fr.status === "rejected", "رفض أي معتمِد يرفض المقترح المعلّق");
  ok((await num(`SELECT count(*) FROM uqn_fix.amendment_review WHERE op_id = 'OP-F'`)) === 0, "ولا يُكتب قرار في المصدر");
  ok((await listAmendmentQueue(db, { limit: 100 })).items.find((i) => i.op_id === "OP-F")?.pending_approvals === 0, "ويعود العنصر إلى الطابور بلا مقترح");
  const fr2 = await decideAmendmentOp(db, reviewer2, "OP-F", { decision: "rejected", note: "النص لا يطابق الأداة" });
  ok(fr2.status === "pending", "الرفض قرار يحتاج الحد نفسه (مقترح رفض معلّق)");
  const fr3 = await decideAmendmentOp(db, reviewer, "OP-F", { decision: "rejected", note: "أوافق على الرفض", expectedDecisionHash: fr2.decisionHash });
  ok(fr3.status === "published" && (await one<{ decision: string }>(`SELECT decision FROM uqn_fix.amendment_review WHERE op_id = 'OP-F'`)).decision === "rejected", "واكتمال مقترح الرفض يكتب الرفض في المصدر");

  const g1 = await decideAmendmentOp(db, reviewer, "OP-G", { decision: "approved" });
  await rejects(() => bulkApproveAmendmentOps(db, reviewer2, ["OP-G"]), "CONFLICT", "الاعتماد الجماعي يرفض عملية عليها مقترح معلّق");
  await rejects(() => withdrawChangeSet(db, outsider, g1.changeSetId, { reason: "ليس معتمدًا" }), "FORBIDDEN", "من لا تكليف له لا يسحب المقترح");
  await withdrawChangeSet(db, reviewer2, g1.changeSetId, { reason: "مقترح متروك" });
  ok((await listAmendmentQueue(db, { limit: 100 })).items.find((i) => i.op_id === "OP-G")?.pending_approvals === 0, "لكل قفل مخرج: سحب المقترح يفك source_ref ويعيد العملية");
  const bulk2 = await bulkApproveAmendmentOps(db, reviewer, ["OP-G"], "جماعي بموافقتين");
  ok(bulk2.status === "pending" && bulk2.approved === 0, "الاعتماد الجماعي بحد 2 يفتح دفعة معلّقة");
  const bulkDone = await decideChangeSet(db, reviewer2, bulk2.changeSetId, { decision: "approve" });
  ok(bulkDone.status === "published" && (await num(`SELECT count(*) FROM uqn_fix.amendment_review WHERE op_id = 'OP-G'`)) === 1, "وتكمله موافقة معتمِد آخر من مسار الدفعات فيُطبَّق");

  const p4a = await decidePrinciple(db, reviewer, "P4", { decision: "approve" });
  ok(p4a.status === "pending" && p4a.reviewStatus === "needs_review", "المبدأ: أول موافقة معلّقة والحالة لم تتغير");
  ok((await listPrincipleQueue(db, { view: "waiting_others" }, reviewer)).items.find((i) => i.id === "P4")?.pending_approvals === 1, "طابور المبادئ يعرض المقترح المعلّق");
  ok((await listPrincipleQueue(db, {})).items.find((i) => i.id === "P4")?.source_case_id === "c1", "source_case_id للمبدأ");
  const p4b = await decidePrinciple(db, kindOnly, "P4", { decision: "approve", expectedDecisionHash: p4a.decisionHash });
  ok(p4b.status === "published" && p4b.reviewStatus === "reviewed", "وموافقة معتمِد مكلَّف بالمبادئ وحدها تكمله");
  ok((await one<{ reviewStatus: string }>(`SELECT "reviewStatus" FROM judicial_principles WHERE id = 'P4'`)).reviewStatus === "reviewed", "والحالة محفوظة في المصدر");
  await writeConfig((cfg3) => {
    cfg3.policies.review_amendment_op.minApprovals = 1;
    cfg3.policies.review_principle.minApprovals = 1;
  });

  // ── عقد الواجهة ──
  console.log("\n— التوحيد: عقد الواجهة —");
  const counts = await intakeCounts(db);
  ok(counts.autoRelations === null && counts.unavailable.includes("legal_relations"), "intakeCounts: المصدر غير المتاح null لا صفر");
  ok(typeof counts.amendmentOpsUndecided === "number", "والمتاح رقم");
  const views = await listChangeSetsDetailed(db, owner, { status: "published", limit: 200 });
  const g5View = views.find((v) => v.id === g5.changeSetId);
  ok(Boolean(g5View) && g5View!.changes.every((ch) => ch.target_name?.startsWith("نظام التوحيد") && !ch.summary.includes("{") && ch.summary.includes("←")), "ChangeView: target_name من legal_systems وsummary سطر عربي لا JSON");
  ok(g5View?.approvals === 1 && g5View.required_approvals === 1 && g5View.my_decision === null, "approvals وrequired_approvals وmy_decision");
  ok(g5View?.revertible === true, "revertible لدفعة ما زالت أهدافها على ما نشرته");
  ok(views.find((v) => v.id === A)?.revertible === false, "وغير قابلة للتراجع بعد نشر أحدث على الهدف");
  ok(views.find((v) => v.id === bulk2.changeSetId)?.revertible === false, "ولا لقرارات المقترحات");
  const reviewerView = (await listChangeSetsDetailed(db, reviewer, { status: "published", limit: 200 })).find((v) => v.id === g5.changeSetId);
  ok(reviewerView?.my_decision === "approve", "my_decision للمعتمِد");
  const opView = views.find((v) => v.id === e2.changeSetId);
  ok(Boolean(opView?.changes[0].summary.includes("OP-E")) && opView!.changes[0].target_name === "نظام اختبار S1", "summary لقرار عملية التعديل بالعربية");
  ok((await getSystemSummary(db, "U9"))?.domain === "CIVIL" && (await getSystemSummary(db, "nope")) === null, "ملخص النظام لـ GET /systems/:id");

  // ── أخطاء بشكل محرك الإنتاج (Prisma P2010 + meta.code) ──
  console.log("\n— التوحيد: أخطاء Prisma —");
  const prismaDb = prismaShapedDb(pool);
  const dup2 = await publishable("قرار مكرر 2", "U3", "مستبدل", "920");
  await writeConfig((cfg4) => {
    cfg4.policies.set_work_status.minApprovals = 2;
  });
  await decideChangeSet(prismaDb, reviewer, dup2, { decision: "approve" });
  await rejects(() => decideChangeSet(prismaDb, reviewer, dup2, { decision: "approve" }), "ALREADY_DECIDED", "23505 على UNIQUE القرار يصل ALREADY_DECIDED عبر شكل Prisma");
  await writeConfig((cfg5) => {
    cfg5.policies.set_work_status.minApprovals = 1;
  });
  await withdrawChangeSet(db, owner, dup2, { reason: "تنظيف" });
  const raceDb = prismaShapedDb(pool, { match: /^\s*INSERT INTO editorial_change/, code: "23505", hideOpenCheck: true });
  const holder = await createChangeSet(db, editor, { title: "حامل القفل", changes: [{ op: "set_work_status", targetId: "U4", status: "ساري", evidence: EVIDENCE("921") }] });
  const race = await rejects(
    () => createChangeSet(raceDb, owner, { title: "سباق", changes: [{ op: "set_work_status", targetId: "U4", status: "ملغى", evidence: EVIDENCE("922") }] }),
    "OPEN_CHANGE_EXISTS",
    "سباق على فهرس القفل بشكل Prisma يصل OPEN_CHANGE_EXISTS (لا 500)",
  );
  ok(race?.detail?.openChangeSetId === holder.changeSetId, "ويُقرأ معرّف المفتوح بعد إلغاء المعاملة");
  await withdrawChangeSet(db, editor, holder.changeSetId, { reason: "تنظيف" });
  const missingDb: SqlClient = {
    query: async () => {
      throw prismaShapedError("42P01", 'relation "editorial_config" does not exist');
    },
  };
  const missing = await loadEditorialConfig(missingDb);
  ok(missing.installed === false && missing.version === 0 && missing.config.bindings.length === 0, "جدول الإعدادات الغائب (42P01 في meta.code) = لا تكليف لأحد");

  // ── الحماية: TRUNCATE والمشغّل المعطّل ──
  console.log("\n— التوحيد: الحماية —");
  for (const table of ["change_set", "editorial_change", "review_decision", "audit_event", "index_sync", "editorial_config"]) {
    ok(await tryQ(`TRUNCATE ${table} CASCADE`), `P2 TRUNCATE ${table} مرفوض`);
  }
  await pool.query(`ALTER TABLE audit_event DISABLE TRIGGER audit_event_append_only`);
  const disabled = await checkDeskIntegrity(db);
  ok(!disabled.ok && disabled.missing.includes("audit_event_append_only:disabled"), "P3 المشغّل المعطّل يُكتشف");
  const p3err = await rejects(
    () => createChangeSet(db, editor, { title: "مشغّل معطّل", changes: [{ op: "set_work_status", targetId: "U6", status: "ملغى", evidence: EVIDENCE("923") }] }),
    "INVALID_STATE",
    "P3 والكتابة تُقفل",
  );
  ok(
    Boolean(p3err) && !JSON.stringify({ m: p3err?.message, d: p3err?.detail }).includes("audit_event") && p3err?.detail?.missingCount === 1,
    "ن٤ أسماء المشغّلات لا تصل العميل (تبقى في سجل الخادم)",
  );
  await pool.query(`ALTER TABLE audit_event ENABLE REPLICA TRIGGER audit_event_append_only`);
  ok((await checkDeskIntegrity(db)).missing.includes("audit_event_append_only:disabled"), "ومشغّل وضع النسخ فقط (R) يُعدّ معطّلًا");
  await pool.query(`ALTER TABLE audit_event ENABLE TRIGGER audit_event_append_only`);
  await pool.query(`DROP TRIGGER editorial_config_no_truncate ON editorial_config`);
  await pool.query(`CREATE TRIGGER editorial_config_no_truncate BEFORE TRUNCATE ON index_sync FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only()`);
  ok((await checkDeskIntegrity(db)).missing.includes("editorial_config_no_truncate:wrong_table"), "المشغّل المربوط بجدول آخر يُكتشف");
  await pool.query(`DROP TRIGGER editorial_config_no_truncate ON index_sync`);
  await pool.query(readFileSync(join(c.root, "prisma/migrations/20261017090000_editorial_desk_phase0/migration.sql"), "utf8"));
  ok((await checkDeskIntegrity(db)).ok, "إعادة تطبيق الترحيل تستعيد الحماية كلها");
}

// ── ملحق العقد — الجولة الثانية (م١، م٤، م٩؛ ق٢٣، ق٢٦، ق٣١، ق٣٢) ─────────────

async function round2Tests(c: UnifyCtx) {
  const { pool, db, one, num, writeConfig, owner, reviewer } = c;
  const reviewer2 = actor("u-reviewer2", "JUDGE", ["reviewer", "publisher"]);
  const kindOnly = actor("u-kind", "LAWYER", ["reviewer"]);
  const writes = async () =>
    num(`SELECT (SELECT count(*) FROM change_set) + (SELECT count(*) FROM editorial_change) + (SELECT count(*) FROM review_decision)
               + (SELECT count(*) FROM uqn_fix.amendment_review) + (SELECT count(*) FROM editorial_config)`);
  const addOp = (id: string, title: string, article: number | null, confidence = "rule_exact") =>
    pool.query(
      `INSERT INTO uqn_fix.amendment_op (op_id, effect_id, instrument_kind, instrument_no, source_url, target_law_title, target_hakeem_code,
          target_resolution, op_type, article_number, new_text, risks, confidence, verbatim_in_source, evidence_quote, raw)
       VALUES ($1, 'E1', 'royal_decree', 'م/9', 'https://uqn.gov.sa/details?p=9', $2, 'S1', 'hakeem_reference_code',
               'replace_article_text', $3, 'نص جديد', '{}'::text[], $4, TRUE, 'تعدل المادة لتكون بالنص الآتي', '{}'::jsonb)`,
      [id, title, article, confidence],
    );
  // الترتيب المتوقع: rule_exact حرفي محلول أولًا، ثم النظام، ثم المادة NULLS LAST، ثم المعرّف.
  await addOp("K3", "نظام ترقيم أ", null);
  await addOp("K1", "نظام ترقيم أ", 1);
  await addOp("K2", "نظام ترقيم أ", 2);
  await addOp("K6", "نظام ترقيم ب", null);
  await addOp("K4", "نظام ترقيم ب", 5);
  await addOp("K5", "نظام ترقيم ب", 7);
  await addOp("K7", "نظام ترقيم أ", 3, "needs_review");
  const expected = ["K1", "K2", "K3", "K4", "K5", "K6", "K7"];
  const filter = { target: "ترقيم" };

  console.log("\n— الجولة الثانية: الترقيم بالمفتاح —");
  const full = await listAmendmentQueue(db, { ...filter, limit: 100 });
  ok(full.items.map((i) => i.op_id).join(",") === expected.join(",") && full.next_cursor === null, "ترتيب الطابور الحالي محفوظ (الأولوية، النظام، المادة NULLS LAST، المعرّف)");
  const walked: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: Awaited<ReturnType<typeof listAmendmentQueue>> = await listAmendmentQueue(db, { ...filter, limit: 2, after: cursor });
    walked.push(...page.items.map((i) => i.op_id));
    cursor = page.next_cursor;
    pages += 1;
  } while (cursor && pages < 10);
  ok(walked.join(",") === expected.join(",") && pages === 4, "المرور بالمؤشر صفحةً صفحة يعطي الترتيب نفسه بلا تكرار ولا تخطٍّ (عبر حد الأولوية والمادة الفارغة)");
  await rejects(() => listAmendmentQueue(db, { ...filter, after: "not-a-cursor" }), "INVALID_INPUT", "المؤشر غير الصالح يُرفض");
  // التكافؤ مع عبارة الترتيب الأصلية على كل العمليات غير المقررة في القاعدة.
  const original = await pool.query(
    `SELECT o.op_id FROM uqn_fix.amendment_op o
      WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review r WHERE r.op_id = o.op_id)
      ORDER BY (o.confidence = 'rule_exact' AND o.verbatim_in_source IS TRUE AND o.target_hakeem_code IS NOT NULL) DESC,
               o.target_law_title, o.article_number NULLS LAST, o.op_id`,
  );
  ok(
    (await listAmendmentQueue(db, { limit: 100 })).items.map((i) => i.op_id).join(",") === original.rows.map((r) => r.op_id).join(","),
    "مفاتيح الترتيب الجديدة تكافئ عبارة ORDER BY الأصلية على كل الطابور",
  );

  await writeConfig((cfg) => {
    cfg.policies.review_amendment_op.minApprovals = 2;
    cfg.policies.review_principle.minApprovals = 2;
  });
  const page1 = await listAmendmentQueue(db, { ...filter, limit: 3 }, reviewer);
  ok(page1.items.map((i) => i.op_id).join(",") === "K1,K2,K3" && page1.next_cursor !== null, "الصفحة الأولى ثلاثة عناصر ومعها next_cursor");
  const k1 = await decideAmendmentOp(db, reviewer, "K1", { decision: "approved", note: "مطابق للأداة" });
  const k2 = await decideAmendmentOp(db, reviewer, "K2", { decision: "approved" });
  const k3 = await decideAmendmentOp(db, reviewer, "K3", { decision: "approved_with_edit", corrected: { article_number: 4 }, note: "رقم المادة 4" });
  const page2 = await listAmendmentQueue(db, { ...filter, limit: 3, after: page1.next_cursor }, reviewer);
  ok(page2.items[0]?.op_id === "K4", "ق٢٦-١ بعد قرارات محلية في الصفحة الأولى، أول عنصر في التالية هو الرابع في الترتيب الأصلي (صفر تخطٍّ)");
  const byOffset = await listAmendmentQueue(db, { ...filter, limit: 3, offset: 3 }, reviewer);
  ok(byOffset.items[0]?.op_id !== "K4", "والإزاحة القديمة (ما زالت مقبولة للتوافق) كانت ستتخطاه");

  console.log("\n— الجولة الثانية: العرضان mine وwaiting_others —");
  const mine = await listAmendmentQueue(db, { ...filter, limit: 100 }, reviewer);
  ok(mine.items.map((i) => i.op_id).join(",") === "K4,K5,K6,K7" && mine.total === 4, "ق٣٢ العرض الافتراضي mine يستبعد ما وافقتُ عليه وينتظر غيري، وtotal له");
  ok(mine.waiting_others === 3, "waiting_others = 3");
  const waiting = await listAmendmentQueue(db, { ...filter, limit: 100, view: "waiting_others" }, reviewer);
  ok(waiting.items.map((i) => i.op_id).join(",") === "K1,K2,K3" && waiting.total === 3 && waiting.items.every((i) => i.my_approval), "waiting_others يعرض ما وافقتُ عليه وينتظر غيري");
  const other = await listAmendmentQueue(db, { ...filter, limit: 100 }, reviewer2);
  ok(other.total === 7 && other.waiting_others === 0, "والمعتمِد الآخر يراها كلها في mine (تنتظر قراره)");

  console.log("\n— الجولة الثانية: حمولة القرار المعلّق —");
  const i1 = other.items.find((i) => i.op_id === "K1");
  ok(
    i1?.pending_decision?.decision === "approved" && i1.pending_corrected === null && i1.pending_note === "مطابق للأداة" && i1.pending_decision_hash === k1.decisionHash && /^[0-9a-f]{64}$/.test(i1.pending_decision_hash ?? ""),
    "ق٢٣-١ القرار المعروض وملاحظته وبصمته",
  );
  ok(i1?.pending_approvers.length === 1 && i1.pending_approvers[0].id === "u-reviewer" && i1.pending_approvers[0].name === "معتمد" && !Number.isNaN(Date.parse(i1.pending_approvers[0].at)), "أصحاب الموافقات باسمهم ووقتهم");
  const i3 = other.items.find((i) => i.op_id === "K3");
  ok(i3?.pending_decision?.decision === "approved_with_edit" && i3.pending_corrected?.article_number === 4, "حمولة التصحيح في القرار المعلّق");
  ok(other.items.find((i) => i.op_id === "K4")?.pending_decision === null && other.items.find((i) => i.op_id === "K4")?.pending_approvers.length === 0, "العنصر بلا مقترح: الحقول فارغة");

  console.log("\n— الجولة الثانية: expectedDecisionHash —");
  let before = await writes();
  await rejects(() => decideAmendmentOp(db, reviewer2, "K1", { decision: "approved" }), "CONFLICT", "البصمة إلزامية حين يوجد قرار معلّق (409)");
  const wrong = await rejects(() => decideAmendmentOp(db, reviewer2, "K1", { decision: "approved", expectedDecisionHash: "0".repeat(64) }), "CONFLICT", "بصمة مخالفة = 409");
  ok(wrong?.message === "تغيّر القرار المعروض؛ راجعه." && wrong.detail?.currentDecisionHash === k1.decisionHash, "برسالة «تغيّر القرار المعروض؛ راجعه» ومعها البصمة الحالية");
  await rejects(() => decideAmendmentOp(db, reviewer2, "K1", { decision: "approved", expectedDecisionHash: "abc" }), "INVALID_INPUT", "بصمة بصيغة غير صالحة تُرفض");
  await rejects(
    () => decideAmendmentOp(db, reviewer2, "K3", { decision: "approved_with_edit", corrected: { article_number: 9 }, expectedDecisionHash: k3.decisionHash ?? "" }),
    "CONFLICT",
    "الموافقة الثانية لا تغيّر التصحيح",
  );
  await rejects(() => decideAmendmentOp(db, reviewer2, "K1", { decision: "approved_with_edit", corrected: { article_number: 2 }, expectedDecisionHash: k1.decisionHash ?? "" }), "CONFLICT", "ولا القرار");
  ok((await writes()) === before, "صفر كتابة في كل ما سبق");
  const k3done = await decideAmendmentOp(db, reviewer2, "K3", { decision: "approved_with_edit", expectedDecisionHash: k3.decisionHash ?? "" });
  ok(k3done.status === "published", "الموافقة الثانية بالبصمة بلا إعادة إرسال التصحيح تكمل القرار");
  ok((await one<{ corrected: { article_number: number } }>(`SELECT corrected FROM uqn_fix.amendment_review WHERE op_id = 'K3'`)).corrected.article_number === 4, "ويُطبَّق التصحيح المعروض نفسه");
  ok((await decideAmendmentOp(db, reviewer2, "K1", { decision: "approved", expectedDecisionHash: k1.decisionHash ?? "" })).status === "published", "وموافقة K1 بالبصمة تكملها");
  await withdrawChangeSet(db, reviewer2, k2.changeSetId, { reason: "مقترح متروك" });
  before = await writes();
  await rejects(() => decideAmendmentOp(db, reviewer2, "K2", { decision: "approved", expectedDecisionHash: k2.decisionHash ?? "" }), "CONFLICT", "بصمة مقترح سُحب = 409، ولا يُفتح مقترح جديد باسم الموافقة الثانية");
  ok((await writes()) === before, "صفر كتابة");
  const k4 = await decideAmendmentOp(db, reviewer, "K4", { decision: "rejected", note: "لا يطابق الأداة" });
  const k4done = await decideAmendmentOp(db, reviewer2, "K4", { decision: "rejected", expectedDecisionHash: k4.decisionHash ?? "" });
  ok(k4done.status === "published" && (await one<{ decision: string }>(`SELECT decision FROM uqn_fix.amendment_review WHERE op_id = 'K4'`)).decision === "rejected", "الموافقة على مقترح رفض لا تشترط سببًا جديدًا");
  const k5 = await decideAmendmentOp(db, reviewer, "K5", { decision: "approved" });
  before = await writes();
  await rejects(() => decideAmendmentOp(db, reviewer2, "K5", { decision: "rejected", expectedDecisionHash: k5.decisionHash ?? "" }), "REASON_REQUIRED", "رفض القرار المعلّق يحتاج سببًا (يرفض القرار كله)");
  ok((await writes()) === before, "صفر كتابة");
  ok((await decideAmendmentOp(db, reviewer2, "K5", { decision: "rejected", note: "خطأ في المادة", expectedDecisionHash: k5.decisionHash ?? "" })).status === "rejected", "وبسبب مكتوب يرفضه");

  await pool.query(`INSERT INTO judicial_principles (id, title, "principleText", "sourceCaseId", "reviewStatus", confidence) VALUES ('P5','مبدأ خامس','نص المبدأ الخامس','c1','needs_review', 0.5)`);
  const p5 = await decidePrinciple(db, reviewer, "P5", { decision: "approve", reason: "سليم" });
  const p5item = (await listPrincipleQueue(db, {}, kindOnly)).items.find((i) => i.id === "P5");
  ok(
    p5item?.pending_decision?.decision === "approve" && p5item.pending_decision_hash === p5.decisionHash && p5item.pending_note === "سليم" && p5item.pending_approvers[0]?.id === "u-reviewer" && p5item.pending_corrected === null,
    "المبدأ: القرار المعروض وبصمته وصاحبه",
  );
  before = await writes();
  await rejects(() => decidePrinciple(db, kindOnly, "P5", { decision: "approve" }), "CONFLICT", "المبدأ: البصمة إلزامية حين يوجد قرار معلّق");
  ok((await writes()) === before, "صفر كتابة");
  ok((await decidePrinciple(db, kindOnly, "P5", { decision: "approve", expectedDecisionHash: p5.decisionHash ?? "" })).status === "published", "والموافقة بالبصمة تكمله");

  console.log("\n— الجولة الثانية: ترقيم المبادئ —");
  for (const [id, conf] of [["Q1", 0.9], ["Q2", null], ["Q3", 0.9], ["Q4", 0.2]] as const) {
    await pool.query(`INSERT INTO judicial_principles (id, title, "principleText", "sourceCaseId", "reviewStatus", confidence, topic) VALUES ($1, $2, 'نص', 'c1', 'needs_review', $3, 'ترقيم')`, [id, `مبدأ ${id}`, conf]);
  }
  const pAll = await listPrincipleQueue(db, { topic: "ترقيم", limit: 100 });
  ok(pAll.items.map((i) => i.id).join(",") === "Q1,Q3,Q4,Q2", "ترتيب المبادئ محفوظ (الثقة تنازليًّا NULLS LAST ثم المعرّف)");
  const pOriginal = await pool.query(`SELECT id FROM judicial_principles WHERE "reviewStatus" = 'needs_review' ORDER BY confidence DESC NULLS LAST, id`);
  ok((await listPrincipleQueue(db, { limit: 100 })).items.map((i) => i.id).join(",") === pOriginal.rows.map((r) => r.id).join(","), "وتكافئ عبارة الترتيب الأصلية");
  const pWalk: string[] = [];
  let pc: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listPrincipleQueue>> = await listPrincipleQueue(db, { topic: "ترقيم", limit: 1, after: pc });
    pWalk.push(...page.items.map((i) => i.id));
    pc = page.next_cursor;
  } while (pc && pWalk.length < 10);
  ok(pWalk.join(",") === "Q1,Q3,Q4,Q2", "والمرور بالمؤشر يعطي الترتيب نفسه");
  const q1 = await decidePrinciple(db, reviewer, "Q1", { decision: "approve" });
  const pMine = await listPrincipleQueue(db, { topic: "ترقيم", limit: 100 }, reviewer);
  ok(!pMine.items.some((i) => i.id === "Q1") && pMine.waiting_others === 1 && pMine.total === 3, "المبادئ: mine يستبعد ما وافقتُ عليه، وwaiting_others = 1");
  ok((await listPrincipleQueue(db, { topic: "ترقيم", view: "waiting_others" }, reviewer)).items.map((i) => i.id).join(",") === "Q1", "وwaiting_others يعرضه");

  console.log("\n— الجولة الثانية: معاينة أثر الإعدادات —");
  // دفعة تحرير معلّقة بموافقة واحدة من اثنتين، ومقترحات استقبال معلّقة (K6، Q1).
  await writeConfig((cfg) => {
    cfg.policies.set_work_status.minApprovals = 2;
  });
  const manual = await createChangeSet(db, owner, { title: "معاينة", changes: [{ op: "set_work_status", targetId: "U7", status: "مستبدل", evidence: EVIDENCE("931") }] });
  await submitChangeSet(db, owner, manual.changeSetId);
  await decideChangeSet(db, reviewer, manual.changeSetId, { decision: "approve" });
  await decideAmendmentOp(db, reviewer, "K6", { decision: "approved" });
  const view = await readEditorialSettings(db, owner);
  const cfg = JSON.parse(JSON.stringify(view.config)) as EditorialConfig;
  before = await writes();
  const auditBefore = await num(`SELECT count(*) FROM audit_event`);
  const same = await previewEditorialSettings(db, owner, cfg);
  ok(same.approvalsDropped === 0 && same.pendingRaised === 0, "ق٣١ الإعدادات نفسها: لا أثر (صفر = لا سطر)");
  const reviewerApprovals = await num(
    `SELECT count(DISTINCT s.id) FROM change_set s JOIN review_decision d ON d.change_set_id = s.id
      WHERE s.status IN ('pending','approved') AND d.reviewer_id = 'u-reviewer' AND d.decision = 'approve' AND d.payload_hash = s.payload_hash`,
  );
  const revoked = JSON.parse(JSON.stringify(cfg)) as EditorialConfig;
  revoked.bindings = revoked.bindings.map((b) => (b.userId === "u-reviewer" ? { ...b, enabled: false } : b));
  const dropped = await previewEditorialSettings(db, owner, revoked);
  ok(reviewerApprovals >= 3 && dropped.approvalsDropped === reviewerApprovals && dropped.pendingRaised === 0, `سحب تكليف معتمِد: تسقط موافقته من ${reviewerApprovals} دفعة معلّقة`);
  const pendingAmendmentSets = await num(
    `SELECT count(DISTINCT s.id) FROM change_set s JOIN editorial_change ch ON ch.change_set_id = s.id
      WHERE s.status IN ('pending','approved') AND ch.op = 'review_amendment_op'`,
  );
  const raised = JSON.parse(JSON.stringify(cfg)) as EditorialConfig;
  raised.policies.review_amendment_op.minApprovals = 3;
  const r = await previewEditorialSettings(db, owner, raised);
  ok(pendingAmendmentSets >= 1 && r.pendingRaised === pendingAmendmentSets && r.approvalsDropped === 0, `رفع حد التعديلات إلى 3: يرتفع المطلوب لـ ${pendingAmendmentSets} مقترحًا معلّقًا`);
  ok((await writes()) === before && (await num(`SELECT count(*) FROM audit_event`)) === auditBefore, "المعاينة بلا أي كتابة (ولا في السجل)");
  await rejects(() => previewEditorialSettings(db, reviewer, cfg), "FORBIDDEN", "المعاينة للمالك وحده");
  await rejects(() => previewEditorialSettings(db, owner, { ...cfg, policies: { ...cfg.policies, revert: { minApprovals: 9, ownerSelfApproval: true, enabled: true } } }), "INVALID_INPUT", "والإعدادات غير الصالحة تُرفض");

  await withdrawChangeSet(db, owner, manual.changeSetId, { reason: "تنظيف" });
  await writeConfig((cfgx) => {
    cfgx.policies.set_work_status.minApprovals = 1;
    cfgx.policies.review_amendment_op.minApprovals = 1;
    cfgx.policies.review_principle.minApprovals = 1;
  });
  void q1;
}

// ── إصلاحات مراجعة الجودة المستقلة على 655ed39 (م١، ن١، ن٣، ن٤، ن٦، ن٧) ─────

async function qaFixTests(c: UnifyCtx) {
  const { pool, db, num, setBinding, writeConfig, owner, reviewer } = c;
  console.log("\n— إصلاحات مراجعة الجودة —");

  // م١: هوية المُعِدّ بالمستخدم؛ الحساب المقلوب من وكيل إلى بشري لا يعتمد ما أعدّه وكيلًا.
  await pool.query(`INSERT INTO users (id, name, email, role) VALUES ('u-flip','وكيل يُقلب','flip@test.local','TRAINEE')`);
  await pool.query(`INSERT INTO legal_systems (id, name) VALUES ('F1', 'نظام القلب')`);
  await pool.query(
    `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_at)
     VALUES ('v-F1', 'work', 'F1', 'ساري', 'المرسوم الملكي رقم م/1', 'https://uqn.gov.sa/details?p=1', 'يعمل بهذا النظام من تاريخ نشره في الجريدة الرسمية.', 'manual', NOW() - interval '30 days')`,
  );
  await setBinding(binding("u-flip", ["editor_laws"], "agent"));
  const asAgent = actor("u-flip", "TRAINEE", ["editor_laws"], "agent");
  const agentSet = await createChangeSet(db, asAgent, { title: "أعدّه وكيلًا", changes: [{ op: "set_work_status", targetId: "F1", status: "ملغى", evidence: EVIDENCE("941") }] });
  await submitChangeSet(db, asAgent, agentSet.changeSetId);
  const view = await readEditorialSettings(db, owner);
  const flipCfg = JSON.parse(JSON.stringify(view.config)) as EditorialConfig;
  flipCfg.bindings = flipCfg.bindings.map((b) => (b.userId === "u-flip" ? { ...b, kind: "human" as const, roles: ["reviewer", "publisher"] } : b));
  await saveEditorialSettings(db, owner, { baseVersion: view.version, reason: "قلب الوكيل إلى معتمد بشري", config: flipCfg });
  const asHuman = actor("u-flip", "TRAINEE", ["reviewer", "publisher"]);
  await rejects(() => decideChangeSet(db, asHuman, agentSet.changeSetId, { decision: "approve" }), "SELF_APPROVAL_FORBIDDEN", "م١ الحساب المقلوب بشريًّا لا يعتمد ما أعدّه وكيلًا");
  ok((await num(`SELECT count(*) FROM review_decision WHERE change_set_id = $1`, [agentSet.changeSetId])) === 0, "م١ ولم يُكتب قرار");
  // ولو وُجد صف قرار منه (إدراج مباشر) فلا يُعدّ موافقة.
  const hash = (await pool.query(`SELECT payload_hash FROM change_set WHERE id = $1`, [agentSet.changeSetId])).rows[0].payload_hash as string;
  await pool.query(
    `INSERT INTO review_decision (id, change_set_id, reviewer_id, decision, reason, self_approval, payload_hash) VALUES ('rd-flip', $1, 'u-flip', 'approve', NULL, FALSE, $2)`,
    [agentSet.changeSetId, hash],
  );
  const flipView = (await listChangeSetsDetailed(db, owner, { id: agentSet.changeSetId }))[0];
  ok(flipView?.approvals === 0, "م١ وموافقة المُعِدّ (بأي نوع حساب) لا تُعدّ في approvalState");
  ok((await decideChangeSet(db, reviewer, agentSet.changeSetId, { decision: "approve" })).status === "approved", "م١ ومعتمِد آخر يعتمدها");
  await withdrawChangeSet(db, owner, agentSet.changeSetId, { reason: "تنظيف" });

  // ن١: رسالة 409 مفهومة بلا اسم الحقل الداخلي.
  await writeConfig((cfg) => {
    cfg.policies.review_amendment_op.minApprovals = 2;
  });
  await pool.query(
    `INSERT INTO uqn_fix.amendment_op (op_id, effect_id, instrument_kind, instrument_no, source_url, target_law_title, target_hakeem_code,
        target_resolution, op_type, article_number, new_text, risks, confidence, verbatim_in_source, evidence_quote, raw)
     VALUES ('FX1', 'E1', 'royal_decree', 'م/9', 'https://uqn.gov.sa/details?p=9', 'نظام اختبار S1', 'S1', 'hakeem_reference_code',
             'replace_article_text', 1, 'نص جديد', '{}'::text[], 'rule_exact', TRUE, 'تعدل المادة لتكون بالنص الآتي', '{}'::jsonb)`,
  );
  const fx = await decideAmendmentOp(db, reviewer, "FX1", { decision: "approved" });
  const stale = await rejects(() => decideAmendmentOp(db, owner, "FX1", { decision: "approved" }), "CONFLICT", "ن١ قرار على عنصر عليه مقترح معلّق بلا بصمة = 409");
  ok(Boolean(stale) && !stale!.message.includes("expectedDecisionHash") && /[\u0600-\u06FF]/.test(stale!.message) && stale!.message.includes("حدّث الطابور"), "ن١ والرسالة عربية بلا اسم حقل داخلي");
  await withdrawChangeSet(db, owner, fx.changeSetId, { reason: "تنظيف" });
  await writeConfig((cfg) => {
    cfg.policies.review_amendment_op.minApprovals = 1;
  });

  // ن٣: مؤشر برقم غير صحيح، وترميز رابط مكسور = 400 لا 500.
  const badCursor = Buffer.from(JSON.stringify([0, "x", false, 1.5, "y"]), "utf8").toString("base64url");
  await rejects(() => listAmendmentQueue(db, { after: badCursor }), "INVALID_INPUT", "ن٣ مؤشر برقم كسري يُرفض (400) قبل SQL");
  const bigCursor = Buffer.from(JSON.stringify([0, "x", false, 1e12, "y"]), "utf8").toString("base64url");
  await rejects(() => listAmendmentQueue(db, { after: bigCursor }), "INVALID_INPUT", "ن٣ ورقم خارج int يُرفض");
  try {
    decodePathParam("%E0%A4", "المعرّف");
    ok(false, "ن٣ الترميز المكسور يُرفض (لم يُرفض)");
  } catch (error) {
    ok(error instanceof EditorialError && error.code === "INVALID_INPUT", "ن٣ ترميز الرابط المكسور = INVALID_INPUT");
  }

  // ن٦: غير المالك بنسخة خاطئة يتلقى FORBIDDEN لا رقم النسخة.
  const v = await readEditorialSettings(db, owner);
  const ne = await rejects(() => saveEditorialSettings(db, reviewer, { baseVersion: 0, reason: "محاولة بنسخة قديمة", config: v.config }), "FORBIDDEN", "ن٦ فحص المالك قبل النسخة");
  ok(ne?.detail?.currentVersion === undefined, "ن٦ ولا يتسرب رقم النسخة الحالية");
}

/** مفتاح الكتابة في اللوحة، وشرط التحقق الثنائي، ومفتاح الطوارئ (قرار المالك 17/10/2026 22:13). */
async function switchTests(c: UnifyCtx) {
  console.log("\n— مفتاح الكتابة والتحقق الثنائي —");
  const { pool, db, owner, editor, agent } = c;
  const savedEnv = process.env.EDITORIAL_DESK_WRITE;
  for (const id of ["SW1", "SW2", "SW3", "SW4"]) {
    await pool.query(`INSERT INTO legal_systems (id, name) VALUES ($1, $2)`, [id, `نظام المفتاح ${id}`]);
    await pool.query(
      `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_at)
       VALUES ($1, 'work', $2, 'ساري', 'المرسوم الملكي رقم م/1', 'https://uqn.gov.sa/details?p=1', 'يعمل بهذا النظام من تاريخ نشره في الجريدة الرسمية.', 'manual', NOW() - interval '30 days')`,
      [`v-${id}`, id],
    );
  }
  const latest = async () => c.num(`SELECT coalesce(max(version), 0) FROM editorial_config`);
  const change = (id: string, n: string) => ({ title: `مفتاح ${id}`, changes: [{ op: "set_work_status", targetId: id, status: "ملغى", evidence: EVIDENCE(n) }] as ChangeInput[] });

  delete process.env.EDITORIAL_DESK_WRITE; // اللوحة تقرر
  ok(controlsOf((await loadEditorialConfig(db)).config).writeEnabled === false, "SW-1 الإعدادات القائمة بلا مفتاح = مقفلة");
  await rejects(() => createChangeSet(db, editor, change("SW1", "sw1")), "WRITE_DISABLED", "SW-1 بلا متغير البيئة والمفتاح مقفل: الكتابة مرفوضة");
  await rejects(async () => setDeskWriteSwitch(db, editor, { baseVersion: await latest(), reason: "تشغيل الكتابة", writeEnabled: true }), "FORBIDDEN", "SW-2 المفتاح للمالك وحده");
  await rejects(async () => setDeskWriteSwitch(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "تشغيل الكتابة", writeEnabled: true }), "MFA_REQUIRED", "SW-3 التشغيل بلا تحقق ثنائي للمالك مرفوض والشرط قائم");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "قصر", writeEnabled: true }), "REASON_REQUIRED", "SW-3 السبب إلزامي");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: (await latest()) - 1, reason: "تشغيل الكتابة", writeEnabled: true }), "CONFLICT", "SW-3 نسخة قديمة = تعارض");
  process.env.EDITORIAL_DESK_WRITE = "0";
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "تشغيل الكتابة", writeEnabled: true }), "WRITE_DISABLED", "SW-3 مفتاح الطوارئ يمنع التشغيل من اللوحة");
  delete process.env.EDITORIAL_DESK_WRITE;
  ok((await c.num(`SELECT count(*) FROM audit_event WHERE action = 'config.switch'`)) === 0, "SW-3 لا أثر للمحاولات المرفوضة");

  const before = (await loadEditorialConfig(db)).config;
  const v0 = await latest();
  const r = await setDeskWriteSwitch(db, owner, { baseVersion: v0, reason: "تشغيل الكتابة للتجربة", writeEnabled: true });
  const after = (await loadEditorialConfig(db)).config;
  ok(r.version === v0 + 1 && r.controls.writeEnabled && r.controls.requireMfa, "SW-4 المالك المتحقق يشغّل الكتابة بنسخة جديدة والشرط باقٍ");
  ok(JSON.stringify(after.bindings) === JSON.stringify(before.bindings) && JSON.stringify(after.policies) === JSON.stringify(before.policies), "SW-4 التكليفات والسياسات تُنقل كما هي");
  const sw = await c.one<{ actor_id: string; detail: { reason: string; controls: { writeEnabled: boolean } } }>(`SELECT actor_id, detail FROM audit_event WHERE action = 'config.switch' ORDER BY id DESC LIMIT 1`);
  ok(sw.actor_id === owner.id && sw.detail.reason === "تشغيل الكتابة للتجربة" && sw.detail.controls.writeEnabled === true, "SW-4 التغيير في سجل التدقيق باسم المالك وسببه");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "تشغيل مكرر", writeEnabled: true }), "INVALID_STATE", "SW-4 تشغيل المفتوح = لا تغيير");

  const created = await createChangeSet(db, editor, change("SW1", "sw1"));
  ok(Boolean(created.changeSetId), "SW-5 مع المفتاح المفتوح يكتب المحرر المتحقق");
  await rejects(() => createChangeSet(db, { ...editor, mfa: false }, change("SW2", "sw2")), "MFA_REQUIRED", "SW-5 المحرر بلا تحقق ثنائي يُرفض");
  await rejects(() => createChangeSet(db, { ...editor, mfa: undefined }, change("SW2", "sw2b")), "MFA_REQUIRED", "SW-5 التحقق غير المحسوب يُرفض");
  const byAgent = await createChangeSet(db, agent, change("SW3", "sw3"));
  ok(Boolean(byAgent.changeSetId), "SW-5 الوكيل يقترح بلا شرط التحقق الثنائي");

  const cfgNow = (await loadEditorialConfig(db)).config;
  await saveEditorialSettings(db, owner, { baseVersion: await latest(), reason: "حفظ عام للتكليفات", config: { ...cfgNow, controls: { writeEnabled: false, requireMfa: false } } });
  const kept = controlsOf((await loadEditorialConfig(db)).config);
  ok(kept.writeEnabled === true && kept.requireMfa === true, "SW-6 الحفظ العام لا يغيّر المفتاح ولا الشرط (يُنقلان من السابقة)");
  await rejects(async () => saveEditorialSettings(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "حفظ بلا تحقق", config: cfgNow }), "MFA_REQUIRED", "SW-6 حفظ الإعدادات بلا تحقق ثنائي يُرفض والشرط قائم");

  process.env.EDITORIAL_DESK_WRITE = "0";
  await rejects(() => createChangeSet(db, editor, change("SW2", "sw2c")), "WRITE_DISABLED", "SW-7 مفتاح الطوارئ يقفل والمفتاح مفتوح");
  delete process.env.EDITORIAL_DESK_WRITE;

  await setDeskWriteSwitch(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "إيقاف الكتابة", writeEnabled: false });
  ok(controlsOf((await loadEditorialConfig(db)).config).writeEnabled === false, "SW-8 الإيقاف مسموح للمالك ولو بلا تحقق ثنائي");
  await rejects(() => createChangeSet(db, editor, change("SW2", "sw2d")), "WRITE_DISABLED", "SW-8 بعد الإيقاف تُرفض الكتابة فورًا");

  await setDeskWriteSwitch(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "إلغاء شرط التحقق الثنائي", writeEnabled: false, requireMfa: false });
  await setDeskWriteSwitch(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "تشغيل بلا شرط", writeEnabled: true });
  const relaxed = await createChangeSet(db, { ...editor, mfa: false }, change("SW4", "sw4"));
  ok(Boolean(relaxed.changeSetId), "SW-9 بعد إلغاء الشرط بسبب مكتوب يكتب المحرر بلا تحقق ثنائي");
  ok((await c.num(`SELECT count(*) FROM audit_event WHERE action = 'config.switch'`)) === 4, "SW-9 كل تغيير للمفتاح سطر في سجل التدقيق");

  // SW-12 (ن٤): إعادة الشرط تشديد يُسمح للمالك ولو بلا تحقق ثنائي والكتابة مفتوحة، ويسري فورًا.
  const tightened = await setDeskWriteSwitch(db, { ...owner, mfa: false }, { baseVersion: await latest(), reason: "إعادة شرط التحقق الثنائي", writeEnabled: true, requireMfa: true });
  ok(tightened.controls.writeEnabled && tightened.controls.requireMfa, "SW-12 إعادة الشرط والكتابة مفتوحة مسموحة بلا تحقق ثنائي للمالك");
  await rejects(() => createChangeSet(db, { ...editor, mfa: false }, change("SW4", "sw4b")), "MFA_REQUIRED", "SW-12 بعد إعادة الشرط يُرفض المحرر بلا تحقق ثنائي");

  // SW-13 (م١): نسخة المعاينة لا تشغّل المفتاح ولا تحفظ الإعدادات (تشارك قاعدة الإنتاج)، والإيقاف منها مسموح.
  const savedVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  await rejects(() => createChangeSet(db, editor, change("SW4", "sw4c")), "WRITE_DISABLED", "SW-13 المعاينة ترفض الكتابة والمفتاح مفتوح");
  const cfgPrev = (await loadEditorialConfig(db)).config;
  await rejects(async () => saveEditorialSettings(db, owner, { baseVersion: await latest(), reason: "حفظ من المعاينة", config: cfgPrev }), "WRITE_DISABLED", "SW-13 المعاينة لا تحفظ الإعدادات");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "إيقاف وإسقاط الشرط من المعاينة", writeEnabled: false, requireMfa: false }), "WRITE_DISABLED", "SW-13 الإيقاف مع إسقاط الشرط من المعاينة مرفوض (الإيقاف وحده)");
  await setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "إيقاف من المعاينة", writeEnabled: false });
  ok(controlsOf((await loadEditorialConfig(db)).config).writeEnabled === false, "SW-13 الإيقاف من المعاينة مسموح");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "تشغيل من المعاينة", writeEnabled: true }), "WRITE_DISABLED", "SW-13 التشغيل من المعاينة مرفوض");
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "إسقاط الشرط من المعاينة", writeEnabled: false, requireMfa: false }), "WRITE_DISABLED", "SW-13 تغيير الشرط من المعاينة مرفوض");
  if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedVercelEnv;

  // SW-14 (ن١): نسخة مخزّنة تالفة لا يُكتب فوقها الافتراض بصمت؛ المفتاح يرفض حتى تُحفظ نسخة صالحة.
  const goodCfg = (await loadEditorialConfig(db)).config;
  const vBad = (await latest()) + 1;
  await pool.query(`INSERT INTO editorial_config (version, config, reason, actor_id) VALUES ($1, '{"bad":true}'::jsonb, 'نسخة تالفة للتجربة', $2)`, [vBad, owner.id]);
  const switchesBefore = await c.num(`SELECT count(*) FROM audit_event WHERE action = 'config.switch'`);
  await rejects(async () => setDeskWriteSwitch(db, owner, { baseVersion: vBad, reason: "تشغيل فوق التالفة", writeEnabled: true }), "INVALID_STATE", "SW-14 المفتاح يرفض فوق نسخة تالفة");
  ok((await latest()) === vBad && (await c.num(`SELECT count(*) FROM audit_event WHERE action = 'config.switch'`)) === switchesBefore, "SW-14 لا نسخة ولا سطر تدقيق بعد الرفض");
  await pool.query(`INSERT INTO editorial_config (version, config, reason, actor_id) VALUES ($1, $2::jsonb, 'استعادة نسخة صالحة بعد التجربة', $3)`, [vBad + 1, JSON.stringify(goodCfg), owner.id]);

  // يعود الوضع لبقية المجموعة: الشرط مفعّل والكتابة مقفلة بالإعدادات، والمتغير كما كان.
  const finalControls = controlsOf((await loadEditorialConfig(db)).config);
  if (finalControls.writeEnabled || !finalControls.requireMfa) {
    await setDeskWriteSwitch(db, owner, { baseVersion: await latest(), reason: "إعادة الافتراض", writeEnabled: false, requireMfa: true });
  }
  ok(!controlsOf((await loadEditorialConfig(db)).config).writeEnabled && controlsOf((await loadEditorialConfig(db)).config).requireMfa, "SW الوضع بعد المجموعة: مقفلة والشرط قائم");
  if (savedEnv === undefined) delete process.env.EDITORIAL_DESK_WRITE;
  else process.env.EDITORIAL_DESK_WRITE = savedEnv;
}

async function main() {
  pureTests();
  runDeskUiTests(ok);
  await authTests();
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
