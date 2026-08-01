/**
 * اختبارات سياسة المصادر الخادمية — حتمية بلا شبكة.
 * تشغيل: HAKEEM_COMPOSER_SOURCE_POLICY_V2=1 npx tsx scripts/test-source-policy.ts
 */
import {
  composerSourcesToPolicy,
  decideToolAccess,
  describeSourcePolicy,
  isSourcePolicyV2Enabled,
  normalizeSourcePolicy,
  DEFAULT_SOURCE_POLICY,
} from "../lib/modules/hakeem-composer/source-policy";
import { createAgentContext, executeTool } from "../lib/modules/hakeem-agent/tools";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

// علم
process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "1";
t(isSourcePolicyV2Enabled() === true, "العلم مفعّل بـ 1");
process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "0";
t(isSourcePolicyV2Enabled() === false, "العلم معطّل بـ 0");
process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 = "1";

// 1) مرفقات فقط لا تستدعي المكتبة
const att = composerSourcesToPolicy(["attached-only"]);
t(att.legalLibrary === false && att.web === false && att.strictScope === true, "attached-only يبني سياسة صارمة");
t(decideToolAccess("legal_search", att).allowed === false, "مرفقات فقط → منع legal_search");
t(decideToolAccess("comprehensive_legal_scan", att).allowed === false, "مرفقات فقط → منع مسح شامل");
t(decideToolAccess("islamic_library_scan", att).allowed === false, "مرفقات فقط → منع خارجي/ويب");
t(decideToolAccess("read_attachment", att).allowed === true, "مرفقات فقط → السماح بقراءة المرفق");

// 2) أنظمة فقط لا تستدعي الأحكام (في المنسّق) ولا الويب
const core = composerSourcesToPolicy(["legal-core"]);
t(core.legalLibrary === true && core.judgments === false, "أنظمة فقط بلا أحكام");
t(decideToolAccess("legal_search", core).allowed === true, "أنظمة فقط → بحث نظامي مسموح");
t(decideToolAccess("islamic_library_scan", core).allowed === false, "تعطيل الويب يمنع الإسلامي الخارجي");

// 3) تطبيع آمن
const n = normalizeSourcePolicy({ legalLibrary: true, web: true, regulations: false, judgments: false, caseFiles: false, attachments: true, organizationLibrary: false, strictScope: true });
t(n.web === false || process.env.HAKEEM_ALLOW_WEB_SOURCE === "1", "الويب لا يُفعَّل دون HAKEEM_ALLOW_WEB_SOURCE");

t(describeSourcePolicy(DEFAULT_SOURCE_POLICY).includes("مكتبة الأنظمة"), "وصف السياسة الافتراضية");
t(describeSourcePolicy(att).includes("نطاق صارم"), "وصف النطاق الصارم");

// 4) إنفاذ داخل executeTool (بلا شبكة لأدوات تُرفض مبكرًا)
async function main() {
  const ctx = createAgentContext("نص مرفق للاختبار", att);
  const denied = await executeTool("legal_search", { query: "فسخ" }, ctx);
  t(denied.ok === false, "executeTool يرفض legal_search");
  t((denied.data as { code?: string }).code === "SOURCE_POLICY_DENIED", "رمز SOURCE_POLICY_DENIED");
  t(ctx.deniedTools.some((d) => d.tool === "legal_search"), "يُسجَّل الرفض في السياق");

  const read = await executeTool("read_attachment", {}, ctx);
  t(read.ok === true && (read.data as { hasAttachment?: boolean }).hasAttachment === true, "read_attachment يعمل ضمن السياسة");
  t(ctx.invokedTools.includes("read_attachment"), "تُسجَّل الأدوات المستدعاة");

  const scan = await executeTool("comprehensive_legal_scan", { query: "مدد" }, ctx);
  t(scan.ok === false, "المسح الشامل مرفوض في attached-only");

  console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
  if (fail) process.exit(1);
}

void main();
