// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 PR1 — حزمة تحقّق طبقة JDS (عقود + سجلّات) — نقيّة بلا قاعدة بيانات.
// تتحقّق من سلامة السجلّات، وفصل الأصوات (§14)، واكتمال بوّابات الجودة (§27)،
// وقيود عدم النقل بين المسارات (§8.1)، ومنطق التصنيف والصوت (§15/§14).
// تُشغَّل: npm run test:jds
// ─────────────────────────────────────────────────────────────────────────────
import {
  JUDICIAL_QUALITY_GATES,
  JUDICIAL_DOMAIN_PACKS,
  JUDICIAL_PATTERNS,
  BENCH_ONLY_DECISIVE_TERMS,
  ASSERTION_LEVEL_POLICY,
  characterizeJudicialTask,
  voiceProfileFor,
  assertionViolations,
  getDomainPack,
  blockingGatesFor,
  JDS_META,
} from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

function main() {
  // ① سلامة سجلّ بوّابات الجودة (§27): 22 بوّابة JG0..JG21 بمعرّفاتٍ فريدة.
  check("22 بوّابة جودة", JUDICIAL_QUALITY_GATES.length === 22);
  const gateIds = JUDICIAL_QUALITY_GATES.map((g) => g.id);
  check("معرّفات البوّابات فريدة", new Set(gateIds).size === gateIds.length);
  check("تسلسل JG0..JG21", gateIds.every((_, i) => gateIds.includes(`JG${i}`)));

  // ② حزم المجال (§8): معرّفات فريدة، ونسخ إصدار، وربطٌ بفئات playbooks.
  const packIds = JUDICIAL_DOMAIN_PACKS.map((p) => p.id);
  check("معرّفات الحزم فريدة", new Set(packIds).size === packIds.length);
  check("كلّ حزمةٍ لها فئات playbooks", JUDICIAL_DOMAIN_PACKS.every((p) => p.playbookCategories.length > 0));
  check("لا يوجد تاريخ سريان مُختلَق (كلّها PENDING في PR1)", JUDICIAL_DOMAIN_PACKS.every((p) => p.lawAsOfDate === "PENDING"));

  // ③ §8.1 — الأحوال الشخصيّة والجزائيّة معزولتان عن المسارات الأخرى.
  const ps = getDomainPack("PERSONAL_STATUS_PACK");
  check("الأحوال الشخصيّة تمنع النقل من التجاريّة", !!ps && ps.prohibitedTransferFrom.includes("COMMERCIAL"));
  const crim = getDomainPack("CRIMINAL_PACK");
  check("الجزائيّة تمنع النقل من العمّاليّة", !!crim && crim.prohibitedTransferFrom.includes("LABOR"));

  // ④ فصل الأصوات (§14): أنماط أفعال المحكمة لا تُتاح لأدوار الطرف.
  const benchVerbs = JUDICIAL_PATTERNS.filter((p) => p.patternClass === "JUDICIAL_VERB");
  check("أنماط أفعال المحكمة موجودة", benchVerbs.length > 0);
  check(
    "أفعال المحكمة محصورة بأدوار المنصّة القضائيّة",
    benchVerbs.every((p) => p.appliesToRoles.every((r) => r === "JUDGE" || r === "JUDICIAL_ASSISTANT")),
  );
  check(
    "أفعال المحكمة تتطلّب سلطةً ساريةً وفحص سريان",
    benchVerbs.every((p) => p.currentLawCheckRequired && p.requiredAuthorityTypes.includes("CURRENT_OFFICIAL_AUTHORITY")),
  );
  check("لا نمطٌ يدّعي مصدرًا خارجيًّا (لا اختلاق في PR1)", JUDICIAL_PATTERNS.every((p) => p.sourceLayer === "INTERNAL_HAKEEM_POLICY"));

  // ⑤ §15 — التصنيف يشتقّ المسار والمرحلة من النصّ.
  const tc = characterizeJudicialTask({ text: "مذكرة اعتراض على حكم تجاري بطلب نقض" });
  check("اشتقاق المسار التجاريّ", tc.courtTrack === "COMMERCIAL");
  check("اشتقاق مرحلة النقض", tc.litigationStage === "CASSATION");
  check("موقفٌ محافظ: لا أدلّة مفترضة", tc.evidencePosture === "NO_EVIDENCE");

  // ⑥ §14 — صوت الدور: القاضي = صوت المحكمة، المحامي = صوت الطرف.
  check("صوت القاضي محكمة مقيّدة", voiceProfileFor("JUDGE", "DISPOSITION") === "JUDICIAL_BENCH_RESTRICTED");
  check("صوت المحامي طرف", voiceProfileFor("LAWYER", "DEFENSE") === "JUDICIAL_PARTY");
  check("صوت الباحث بحث", voiceProfileFor("RESEARCHER", "ISSUE_MAP") === "JUDICIAL_RESEARCH_AND_TRAINING");
  check("مخرج المنطوق للقاضي مقيّد الخطورة", characterizeJudicialTask({ role: "JUDGE", documentFunction: "DISPOSITION" }).riskLevel === "RESTRICTED");

  // ⑦ §13.4 — مستوى الجزم: «ثبت» محظورٌ عند مجرّد الادّعاء.
  check("«ثبت» محظورة في ASSERTED", assertionViolations("زعم أنه ثبت الدين", "ASSERTED").includes("ثبت"));
  check("«ثبت» مسموحة في ESTABLISHED", assertionViolations("ثبت الدين بالمستند", "ESTABLISHED").length === 0);
  check("كلّ مستوى جزمٍ له سياسة", ASSERTION_LEVEL_POLICY.length === 6);

  // ⑧ ألفاظ الحسم الحصريّة موجودة ومقيّدة بالمحكمة.
  check("ألفاظ الحسم الحصريّة معرّفة", BENCH_ONLY_DECISIVE_TERMS.length > 0);

  // ⑨ بوّابات وظيفة المنطوق تشمل الاتّساق وعدم تجاوز الطلبات.
  const dispGates = blockingGatesFor("DISPOSITION").map((g) => g.id);
  check("منطوق: بوّابة عدم تجاوز الطلبات JG15", dispGates.includes("JG15"));
  check("منطوق: بوّابة اتّساق الأسباب والمنطوق JG16", dispGates.includes("JG16"));

  // ⑩ الوسم الوصفيّ للطبقة.
  check("مرجع الأمر الحاكم HKM-JDS-002", JDS_META.order === "HKM-JDS-002");

  console.log(`\nنتيجة JDS PR1: ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
