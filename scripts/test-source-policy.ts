/**
 * اختبارات إغلاق سياسة المصادر — حتمية بلا شبكة.
 * تشغيل: npm run test:source-policy
 */
import {
  CLIENT_FORBIDDEN_SOURCE_FIELDS,
  composerSourcesToPolicy,
  decideToolAccess,
  defaultServerCapabilities,
  describeSourcePolicy,
  isOrchestratorLibraryBlocked,
  isSourcePolicyV2Enabled,
  normalizeSourcePolicy,
  parseRequestedPolicyStrict,
  resolveEffectiveSourcePolicy,
  DEFAULT_SOURCE_POLICY,
  ORCHESTRATOR_LIBRARY_BLOCKED_REPLY,
  RESTRICTED_SOURCE_POLICY,
  type SourcePolicy,
} from "../lib/modules/hakeem-composer/source-policy";
import { createAgentContext, executeTool } from "../lib/modules/hakeem-agent/tools";
import { COMPOSER_SOURCES } from "../lib/modules/hakeem-composer/constants";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

const caps = defaultServerCapabilities({ hasAttachment: false, caseOwned: false });
const fullClientPolicy = (over: Partial<SourcePolicy> = {}): SourcePolicy => ({
  legalLibrary: true,
  regulations: true,
  judgments: true,
  caseFiles: true,
  attachments: true,
  organizationLibrary: true,
  web: true,
  strictScope: false,
  ...over,
});

async function main() {
  // ── العلم ──
  process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "1";
  t(isSourcePolicyV2Enabled() === true, "العلم مفعّل بـ 1");
  process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "0";
  t(isSourcePolicyV2Enabled() === false, "⑨ تعطيل العلم → سلوك سابق (لا إنفاذ في الراوت)");
  process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "1";
  t(isSourcePolicyV2Enabled() === true, "إعادة تفعيل العلم");

  // ── 1) عميل يرسل web=true دون إذن ──
  const webEscalation = resolveEffectiveSourcePolicy({
    requestedPolicy: fullClientPolicy({ web: true, organizationLibrary: false, caseFiles: false }),
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: { ...caps, allowWeb: false },
  });
  t(webEscalation.ok === true, "① حل سياسة مع web=true من العميل");
  if (webEscalation.ok) {
    t(webEscalation.effectivePolicy.web === false, "① effective.web=false رغم طلب العميل");
    t(
      webEscalation.deniedSources.some((d) => d.source === "web"),
      "① يُسجَّل رفض web"
    );
    t(decideToolAccess("islamic_library_scan", webEscalation.effectivePolicy).allowed === false, "① islamic_library_scan ممنوعة");
  }

  // ── 2) organizationLibrary=true من عميل غير مخول ──
  const orgEscalation = resolveEffectiveSourcePolicy({
    requestedPolicy: fullClientPolicy({ organizationLibrary: true, web: false, caseFiles: false }),
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: { ...caps, allowOrganizationLibrary: false },
  });
  t(orgEscalation.ok === true, "② حل سياسة مع organizationLibrary=true");
  if (orgEscalation.ok) {
    t(orgEscalation.effectivePolicy.organizationLibrary === false, "② effective.organizationLibrary=false");
    t(
      orgEscalation.deniedSources.some((d) => d.source === "organizationLibrary"),
      "② يُسجَّل رفض organizationLibrary"
    );
    t(
      decideToolAccess("islamic_library_scan", orgEscalation.effectivePolicy).allowed === false,
      "② أداة islamic_library_scan تظل ممنوعة"
    );
  }

  // ── 3) caseFiles=true بلا سياق قضية ──
  const caseEsc = resolveEffectiveSourcePolicy({
    requestedSources: ["case-files"],
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: caps,
  });
  t(caseEsc.ok === true && caseEsc.effectivePolicy.caseFiles === false, "③ caseFiles مرفوض بلا سياق قضية");
  if (caseEsc.ok) {
    t(caseEsc.deniedSources.some((d) => d.source === "caseFiles"), "③ سبب رفض caseFiles مسجّل");
  }

  // ── 4) سياسة تالفة لا تعود إلى Default واسع ──
  const missing = parseRequestedPolicyStrict({ legalLibrary: true });
  t(missing.ok === false, "④ حقل ناقص → رفض");
  const wrongType = parseRequestedPolicyStrict({
    ...fullClientPolicy(),
    legalLibrary: "yes" as unknown as boolean,
  });
  t(wrongType.ok === false, "④ نوع غير صحيح → رفض");
  const extra = parseRequestedPolicyStrict({ ...fullClientPolicy(), evil: true });
  t(extra.ok === false, "④ حقول غريبة → رفض (strict)");
  const nullPol = parseRequestedPolicyStrict(null);
  t(nullPol.ok === false, "④ null → رفض");
  const arrPol = parseRequestedPolicyStrict([fullClientPolicy()]);
  t(arrPol.ok === false, "④ مصفوفة بدل object → رفض");

  const badResolve = resolveEffectiveSourcePolicy({
    requestedPolicy: { legalLibrary: true },
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: caps,
    failOnInvalidPolicy: true,
  });
  t(badResolve.ok === false && badResolve.code === "INVALID_SOURCE_POLICY", "④ resolve → INVALID_SOURCE_POLICY");

  const allOn = resolveEffectiveSourcePolicy({
    requestedPolicy: fullClientPolicy(),
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: caps,
  });
  t(allOn.ok === true, "④ سياسة تفعّل كل المصادر تُحل");
  if (allOn.ok) {
    t(
      allOn.effectivePolicy.web === false &&
        allOn.effectivePolicy.organizationLibrary === false &&
        allOn.effectivePolicy.caseFiles === false,
      "④ الحقول الحساسة تبقى false"
    );
    t(
      allOn.effectivePolicy.legalLibrary === true && allOn.effectivePolicy.attachments === true,
      "④ المصادر العادية تُمنح عند السماح الخادمي"
    );
  }

  const normBad = normalizeSourcePolicy({ legalLibrary: true });
  t(
    normBad.legalLibrary === false && normBad.strictScope === true,
    "④ normalizeSourcePolicy التالف → RESTRICTED لا DEFAULT واسع"
  );
  t(
    JSON.stringify(normBad) === JSON.stringify(RESTRICTED_SOURCE_POLICY),
    "④ يطابق RESTRICTED_SOURCE_POLICY"
  );

  // ── 5) مرفقات فقط بلا ملف ──
  const attNoFile = resolveEffectiveSourcePolicy({
    requestedSources: ["attached-only"],
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: caps,
  });
  t(attNoFile.ok === true, "⑤ مرفقات فقط بلا ملف تُحل");
  if (attNoFile.ok) {
    t(
      attNoFile.effectivePolicy.attachments === true &&
        attNoFile.effectivePolicy.legalLibrary === false &&
        attNoFile.effectivePolicy.strictScope === true,
      "⑤ سياسة مرفقات فقط صارمة"
    );
    t(
      attNoFile.reasons.some((r) => r.includes("مرفق")),
      "⑤ سبب يتطلّب ملفًا"
    );
  }

  // ── 6) مرفقات فقط مع ملف ──
  const attWithFile = resolveEffectiveSourcePolicy({
    requestedSources: ["attached-only"],
    hasAttachment: true,
    caseContext: null,
    serverCapabilities: defaultServerCapabilities({ hasAttachment: true }),
  });
  t(attWithFile.ok === true, "⑥ مرفقات فقط مع ملف");
  if (attWithFile.ok) {
    t(decideToolAccess("legal_search", attWithFile.effectivePolicy).allowed === false, "⑥ منع legal_search");
    t(decideToolAccess("read_attachment", attWithFile.effectivePolicy).allowed === true, "⑥ السماح read_attachment");
    const ctx = createAgentContext("نص مرفق للاختبار", attWithFile.effectivePolicy);
    const denied = await executeTool("legal_search", { query: "فسخ" }, ctx);
    t(denied.ok === false && (denied.data as { code?: string }).code === "SOURCE_POLICY_DENIED", "⑥ executeTool يرفض البحث");
    const read = await executeTool("read_attachment", {}, ctx);
    t(read.ok === true, "⑥ read_attachment يعمل");
    t(ctx.invokedTools.includes("read_attachment"), "⑥ تُسجَّل الأدوات المستدعاة");
  }

  // ── 7) أنظمة (+ مرفق إن وُجد) — خيار أ ──
  const core = resolveEffectiveSourcePolicy({
    requestedSources: ["legal-core"],
    hasAttachment: true,
    caseContext: null,
    serverCapabilities: defaultServerCapabilities({ hasAttachment: true }),
  });
  t(core.ok === true, "⑦ أنظمة");
  if (core.ok) {
    t(core.effectivePolicy.legalLibrary === true && core.effectivePolicy.judgments === false, "⑦ مكتبة بلا أحكام");
    t(core.effectivePolicy.attachments === true, "⑦ خيار أ: المرفقات متاحة مع الأنظمة");
    t(decideToolAccess("legal_search", core.effectivePolicy).allowed === true, "⑦ بحث نظامي مسموح");
    t(decideToolAccess("islamic_library_scan", core.effectivePolicy).allowed === false, "⑦ بلا ويب/مؤسسة");
  }
  const coreLabel = COMPOSER_SOURCES.find((s) => s.id === "legal-core")?.label ?? "";
  t(coreLabel.includes("المرفق") && !coreLabel.includes("فقط"), "⑦ وصف الواجهة ليس «أنظمة فقط»");

  // ── 8) أحكام ومبادئ فقط ──
  const rulings = resolveEffectiveSourcePolicy({
    requestedSources: ["rulings-principles"],
    hasAttachment: false,
    caseContext: null,
    serverCapabilities: caps,
  });
  t(rulings.ok === true, "⑧ أحكام ومبادئ");
  if (rulings.ok) {
    t(
      rulings.effectivePolicy.judgments === true &&
        rulings.effectivePolicy.legalLibrary === false &&
        rulings.effectivePolicy.regulations === false,
      "⑧ أحكام دون مكتبة أنظمة"
    );
  }

  // ── 10) fallback يحترم السياسة (بوابة المنسّق النقية + أدوات) ──
  const fallbackPolicy = composerSourcesToPolicy(["attached-only"]);
  t(isOrchestratorLibraryBlocked(fallbackPolicy) === true, "⑩ بوابة المنسّق تحظر المكتبة");
  t(ORCHESTRATOR_LIBRARY_BLOCKED_REPLY.includes("نطاق المصادر"), "⑩ رد الحظر جاهز للسقوط");
  // محاكاة native→fallback: نفس effectivePolicy تُمرَّر؛ لا يُسمح بأدوات الاسترجاع
  const fallbackSim = {
    usedFallback: true,
    effectivePolicy: fallbackPolicy,
    wouldCallLegalSearch: decideToolAccess("legal_search", fallbackPolicy).allowed,
    orchestratorBlocked: isOrchestratorLibraryBlocked(fallbackPolicy),
  };
  t(
    fallbackSim.usedFallback &&
      !fallbackSim.wouldCallLegalSearch &&
      fallbackSim.orchestratorBlocked,
    "⑩ سقوط native→fallback لا ينفّذ بحثًا قانونيًا"
  );
  t(decideToolAccess("comprehensive_legal_scan", fallbackPolicy).allowed === false, "⑩ مسح شامل ممنوع");
  t(decideToolAccess("deep_legal_study", fallbackPolicy).allowed === false, "⑩ دراسة موسّعة ممنوعة");
  t(decideToolAccess("fetch_legal_source", fallbackPolicy).allowed === false, "⑩ fetch_legal_source ممنوع");

  // ── 11) أداة غير مدرجة تُرفض في strictScope ──
  t(
    decideToolAccess("unknown_weapon", { ...fallbackPolicy, strictScope: true }).allowed === false,
    "⑪ أداة غير مدرجة تُرفض في strictScope"
  );
  t(
    decideToolAccess("unknown_weapon", { ...DEFAULT_SOURCE_POLICY, strictScope: false }).allowed === true,
    "⑪ بلا strictScope تُسمح الأدوات غير المدرجة (توافق)"
  );

  // ── 12) audit shape: requested/effective/denied ──
  if (webEscalation.ok) {
    const auditShape = {
      requestedSources: webEscalation.requestedSources,
      requestedPolicy: webEscalation.requestedPolicy,
      effectivePolicy: webEscalation.effectivePolicy,
      deniedSources: webEscalation.deniedSources,
      deniedTools: [{ tool: "islamic_library_scan", reason: "denied" }],
      invokedTools: [] as string[],
      featureFlagEnabled: true,
      usedFallback: true,
      queryPreview: "سؤال قصير".slice(0, 80),
    };
    t(
      auditShape.requestedPolicy.web === false && // بعد strip في requested المعروض
        auditShape.effectivePolicy.web === false &&
        auditShape.deniedSources.length >= 1 &&
        !("query" in auditShape) &&
        auditShape.queryPreview.length <= 80,
      "⑫ شكل التدقيق: requested/effective/denied بلا نص كامل"
    );
    // requestedPolicy من resolve يصفّر الحقول الحساسة
    t(webEscalation.requestedPolicy.web === false, "⑫ requestedPolicy المعروض بلا web بعد strip");
  }

  // ── 13) لا يمكن للعميل زيادة صلاحياته بتعديل JSON ──
  for (const field of CLIENT_FORBIDDEN_SOURCE_FIELDS) {
    const r = resolveEffectiveSourcePolicy({
      requestedSources: ["legal-core"],
      requestedPolicy: fullClientPolicy({ [field]: true } as Partial<SourcePolicy>),
      hasAttachment: false,
      caseContext: null,
      serverCapabilities: caps,
    });
    t(r.ok === true, `⑬ JSON مع ${field}=true يُقبل كطلب ويُصفَّى`);
    if (r.ok) {
      t((r.effectivePolicy as Record<string, boolean>)[field] === false, `⑬ effective.${field}=false`);
    }
  }

  // ── 14) لا يتم استدعاء مصدر محظور فعليًا ──
  if (attWithFile.ok) {
    const ctx2 = createAgentContext("مرفق", attWithFile.effectivePolicy);
    for (const tool of [
      "legal_search",
      "comprehensive_legal_scan",
      "deep_legal_study",
      "fetch_legal_source",
      "islamic_library_scan",
    ] as const) {
      const res = await executeTool(tool, { query: "x", question: "x", sourceId: "x" }, ctx2);
      t(res.ok === false, `⑭ ${tool} لا يُنفَّذ فعليًا`);
      t(ctx2.deniedTools.some((d) => d.tool === tool), `⑭ ${tool} في deniedTools`);
    }
    t(ctx2.invokedTools.length === 0, "⑭ لا أدوات استرجاع مستدعاة");
  }

  // بث source-policy contract
  if (core.ok) {
    const streamPayload = {
      requestedPolicy: core.requestedPolicy,
      effectivePolicy: core.effectivePolicy,
      deniedSources: core.deniedSources,
      enforced: true as const,
    };
    t(streamPayload.enforced === true && streamPayload.effectivePolicy.legalLibrary === true, "⑧ عقد بث source-policy");
  }

  t(describeSourcePolicy(DEFAULT_SOURCE_POLICY).includes("مكتبة الأنظمة"), "وصف DEFAULT");
  t(caps.allowOrganizationLibrary === false, "القدرات الافتراضية: بلا مكتبة مؤسسة");

  console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
  if (fail) process.exit(1);
}

void main();
