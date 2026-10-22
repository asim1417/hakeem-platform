/**
 * HKM-030 — شارة حالة المادة (article-status) تفهم تسميات طبقة التحقق والقيم القديمة، وتُعرض «ملغاة» لا «منسوخة».
 * المستهلكون (enforcement/rerank) يقرؤون kind لا نص الشارة. بلا قاعدة.
 *   npm run test:article-status
 */
import { articleStatusBadge, isRepealedKind } from "../lib/modules/legal-core/article-status";
import { VERIFIED_STATUSES, UNVERIFIED_NOTICE } from "../lib/modules/legal-core/verified-status";
import { resolveEnforcement, isRepealed, isInForce } from "../lib/modules/agents/substrate/enforcement";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

// تسميات التحقق كلها معروفة (لا null).
for (const s of VERIFIED_STATUSES) ok(articleStatusBadge(s) !== null, `تسمية التحقق «${s}» تُعرف`);
ok(articleStatusBadge(UNVERIFIED_NOTICE) === null && articleStatusBadge("") === null && articleStatusBadge(null) === null && articleStatusBadge("سجل مخلوط") === null, "غير المعروف وقيد التحقق: بلا شارة");

const b = (s: string) => articleStatusBadge(s)!;
ok(b("ساري").label === "سارية" && b("ساري").kind === "in_force" && b("ساري").tone === "emerald" && b("ساري").inForce, "ساري → سارية (خضراء، نافذة)");
ok(b("مضافة").label === "مضافة" && b("مضافة").kind === "in_force", "مضافة سارية بوسمها");
ok(b("ملغاة").label === "ملغاة" && b("ملغى").label === "ملغاة" && b("منسوخة").label === "ملغاة" && b("REPEALED").label === "ملغاة", "ملغاة/ملغى/منسوخة/REPEALED → «ملغاة» لا «منسوخة»");
ok(b("ملغاة").kind === "repealed" && b("ملغاة").tone === "ruby" && !b("ملغاة").inForce, "الملغاة: حمراء وغير نافذة");
ok(b("مستبدل").label === "مستبدلة" && b("مستبدل").kind === "replaced" && !b("مستبدل").inForce && b("مستبدل").tone !== "ruby", "مستبدل: مستبدلة، ليست ملغاة (لا حمراء) ولا نافذة");
ok(b("صادر لم يسرِ بعد").kind === "not_yet" && !b("صادر لم يسرِ بعد").inForce && b("صادر لم يسر بعد").kind === "not_yet", "صادر لم يسرِ بعد (مع التشكيل وبدونه)");
ok(b("ملغى مع بقاء أحكام محددة مؤقتًا").kind === "repealed_partial" && b("ملغى مع بقاء أحكام محددة مؤقتا").tone === "ruby", "ملغى مع بقاء أحكام محددة مؤقتًا");
ok(b("إلغاء جزئي معلّق على شرط").kind === "conditional_partial" && b("إلغاء جزئي معلق على شرط").inForce, "إلغاء جزئي معلّق على شرط: نافذة (كقائمة الهيئة)");
ok(b("معدّلة").label === "معدّلة" && b("AMENDED").kind === "amended" && b("معدلة").inForce, "معدّلة");
ok(b("موقوفة").kind === "suspended" && b("SUSPENDED").label === "موقوفة", "موقوفة");
ok(isRepealedKind("repealed") && isRepealedKind("replaced") && isRepealedKind("repealed_partial") && !isRepealedKind("amended") && !isRepealedKind(undefined), "isRepealedKind");

// النفاذ عبر kind: القيم القديمة كما كانت، وتسميات التحقق تُفهم.
ok(resolveEnforcement("منسوخة").state === "لاغٍ" && resolveEnforcement("ملغاة").state === "لاغٍ" && isRepealed("ملغى"), "النفاذ: ملغاة/ملغى/منسوخة لاغية");
ok(resolveEnforcement("مستبدل").state === "لاغٍ" && !isInForce("مستبدل"), "النفاذ: المستبدلة لا يُبنى عليها");
ok(resolveEnforcement("ساري").state === "ساري" && resolveEnforcement("مضافة").inForce && resolveEnforcement("إلغاء جزئي معلّق على شرط").inForce, "النفاذ: ساري/مضافة/إلغاء جزئي معلّق نافذة");
ok(!resolveEnforcement("صادر لم يسرِ بعد").inForce && !isRepealed("صادر لم يسرِ بعد"), "النفاذ: الصادر لم يسرِ ليس نافذًا وليس لاغيًا");
ok(resolveEnforcement(UNVERIFIED_NOTICE).state === "غير_معروف" && resolveEnforcement(UNVERIFIED_NOTICE).inForce, "قيد التحقق: غير معروف (كما كان للمجهول)");

console.log(failed === 0 ? "✓ شارة حالة المادة" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
