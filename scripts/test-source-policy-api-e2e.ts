/**
 * اختبار عقد API لسياسة المصادر (مسار القرار الخادمي بلا خادم حي).
 * يغطي: INVALID_SOURCE_POLICY، مرفقات فقط، تصعيد صلاحيات، وتوافق العلم.
 * تشغيل: npx tsx scripts/test-source-policy-api-e2e.ts
 */
import {
  defaultServerCapabilities,
  isSourcePolicyV2Enabled,
  resolveEffectiveSourcePolicy,
  decideToolAccess,
  isOrchestratorLibraryBlocked,
  ORCHESTRATOR_LIBRARY_BLOCKED_REPLY,
  DEFAULT_SOURCE_POLICY,
  type SourcePolicy,
} from "../lib/modules/hakeem-composer/source-policy";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

/** يحاكي قرار الراوت قبل البث — نفس ترتيب agent-search */
function simulateAgentSearchPolicyGate(body: {
  sources?: unknown;
  sourcePolicy?: unknown;
  document?: string;
}):
  | { status: 400; code: string; body: Record<string, unknown> }
  | {
      status: 200;
      requestedPolicy: SourcePolicy;
      effectivePolicy: SourcePolicy;
      deniedSources: Array<{ source: string; reason: string }>;
      streamSourcePolicy: Record<string, unknown>;
    } {
  const hasDoc = Boolean(String(body.document ?? "").trim());
  const resolved = resolveEffectiveSourcePolicy({
    requestedSources: body.sources,
    requestedPolicy: body.sourcePolicy,
    hasAttachment: hasDoc,
    caseContext: null,
    serverCapabilities: defaultServerCapabilities({ hasAttachment: hasDoc, caseOwned: false }),
    failOnInvalidPolicy: true,
  });
  if (!resolved.ok) {
    return {
      status: 400,
      code: "INVALID_SOURCE_POLICY",
      body: { type: "error", message: resolved.message, code: resolved.code, details: resolved.details },
    };
  }
  const effective = resolved.effectivePolicy;
  if (
    !effective.legalLibrary &&
    !effective.regulations &&
    !effective.judgments &&
    effective.attachments &&
    !hasDoc
  ) {
    return {
      status: 400,
      code: "SOURCE_POLICY_REQUIRES_ATTACHMENT",
      body: {
        type: "error",
        code: "SOURCE_POLICY_REQUIRES_ATTACHMENT",
        requestedPolicy: resolved.requestedPolicy,
        effectivePolicy: effective,
        deniedSources: resolved.deniedSources,
      },
    };
  }
  return {
    status: 200,
    requestedPolicy: resolved.requestedPolicy,
    effectivePolicy: effective,
    deniedSources: resolved.deniedSources.map((d) => ({ source: String(d.source), reason: d.reason })),
    streamSourcePolicy: {
      requestedPolicy: resolved.requestedPolicy,
      effectivePolicy: effective,
      deniedSources: resolved.deniedSources,
      enforced: true,
    },
  };
}

async function main() {
  process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "1";
  t(isSourcePolicyV2Enabled(), "العلم مفعّل لمحاكاة API");

  const invalid = simulateAgentSearchPolicyGate({
    sourcePolicy: { legalLibrary: true, web: true },
  });
  t(invalid.status === 400 && invalid.code === "INVALID_SOURCE_POLICY", "API: سياسة تالفة → 400 INVALID_SOURCE_POLICY");

  const attOnlyNoFile = simulateAgentSearchPolicyGate({ sources: ["attached-only"] });
  t(
    attOnlyNoFile.status === 400 && attOnlyNoFile.code === "SOURCE_POLICY_REQUIRES_ATTACHMENT",
    "API: مرفقات فقط بلا ملف → 400"
  );

  const attOnlyWithFile = simulateAgentSearchPolicyGate({
    sources: ["attached-only"],
    document: "نص عقد للاختبار",
  });
  t(attOnlyWithFile.status === 200, "API: مرفقات فقط مع ملف → 200");
  if (attOnlyWithFile.status === 200) {
    t(attOnlyWithFile.streamSourcePolicy.enforced === true, "API: بث enforced");
    t(attOnlyWithFile.effectivePolicy.legalLibrary === false, "API: effective بلا مكتبة");
    // سقوط native → orchestrator: نفس effectivePolicy + بوابة المنسّق
    t(isOrchestratorLibraryBlocked(attOnlyWithFile.effectivePolicy), "API e2e: fallback يحظر المكتبة");
    t(
      decideToolAccess("legal_search", attOnlyWithFile.effectivePolicy).allowed === false &&
        ORCHESTRATOR_LIBRARY_BLOCKED_REPLY.length > 0,
      "API e2e: لا بحث قانوني بعد السقوط"
    );
  }

  const privilege = simulateAgentSearchPolicyGate({
    sources: ["legal-core"],
    sourcePolicy: {
      legalLibrary: true,
      regulations: true,
      judgments: false,
      caseFiles: true,
      attachments: true,
      organizationLibrary: true,
      web: true,
      strictScope: true,
    },
  });
  t(privilege.status === 200, "API: طلب مع تصعيد JSON");
  if (privilege.status === 200) {
    t(privilege.effectivePolicy.web === false, "API: web لا يُمنح");
    t(privilege.effectivePolicy.organizationLibrary === false, "API: organizationLibrary لا يُمنح");
    t(privilege.effectivePolicy.caseFiles === false, "API: caseFiles لا يُمنح بلا قضية");
    t(privilege.deniedSources.length >= 2, "API: deniedSources تسجّل التصعيد");
    t(decideToolAccess("islamic_library_scan", privilege.effectivePolicy).allowed === false, "API: أداة خارجية ممنوعة");
  }

  process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "0";
  t(isSourcePolicyV2Enabled() === false, "تعطيل العلم");
  // عند التعطيل الراوت يستخدم DEFAULT ولا يستدعي resolve — نوثّق العقد
  t(DEFAULT_SOURCE_POLICY.legalLibrary === true && DEFAULT_SOURCE_POLICY.strictScope === false, "السلوك السابق = DEFAULT واسع");

  console.log(`\nنتيجة e2e عقد API: ${ok} نجح، ${fail} فشل`);
  if (fail) process.exit(1);
}

void main();
