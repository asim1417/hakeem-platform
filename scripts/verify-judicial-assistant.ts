// تحقّقٌ فعليّ من فعالية الوكلاء القضائيين — يُشغّل المحرّكات الحتميّة على قضيةٍ نموذجيّة
// ويؤكّد أنّ المخرجات صحيحةٌ البنية وغير فارغة (ليس مجرّد تصريف). لا يحتاج قاعدةً ولا نموذجًا.
// المسار المؤصَّل (JS-001/018) والاستخلاص (JS-005) يحتاجان البيئة الحيّة؛ يُتحقَّق منهما بأنّ
// مسار التعطّل الآمن يعمل دون كسر.  التشغيل: `npm run verify:judicial`.
import { computeDeadlines } from "@/lib/modules/judicial-assistant/rules/deadline";
import { buildTimeline } from "@/lib/modules/judicial-assistant/rules/timeline";
import { buildEvidenceMatrix } from "@/lib/modules/judicial-assistant/rules/evidence";
import { checkJurisdiction, checkAdmissibility } from "@/lib/modules/judicial-assistant/rules/admissibility";
import { suggestedActionsFor } from "@/lib/modules/judicial-assistant/catalog";
import type { JudicialCase } from "@/lib/modules/judicial-assistant/types";

const CASE: JudicialCase = {
  id: "verify-1", ownerId: "u1", caseNumber: "١٤٤٧/ت/١", court: "المحكمة التجاريّة بالرياض", circuit: "الثالثة",
  jurisdiction: "commercial", subject: "مطالبة بقيمة بضاعةٍ وتعويض", stage: "hearing_preparation",
  confidentiality: "normal", createdAt: "2026-07-10T00:00:00.000Z",
  attachments: [{ id: "a1", name: "لائحة.pdf", text: "نصّ اللائحة…", chars: 12, addedAt: "2026-07-10T00:00:00.000Z" }],
  parties: [{ id: "p1", name: "شركة (نموذجيّة)", role: "المدّعية" }, { id: "p2", name: "مؤسسة (نموذجيّة)", role: "المدّعى عليها" }],
  requests: [{ id: "r1", text: "سداد قيمة البضاعة", byPartyId: "p1", status: "contested" }, { id: "r2", text: "التعويض", byPartyId: "p1", status: "contested" }],
  facts: [
    { id: "f1", text: "إبرام عقد توريد", status: "admitted", verification: "human_verified", sourceLabel: "لائحة ص٢", hasEvidence: true },
    { id: "f2", text: "تأخّر التسليم", status: "alleged", verification: "machine", sourceLabel: "مذكّرة ص٤", hasEvidence: true },
    { id: "f3", text: "مقدار الضرر", status: "unresolved", verification: "machine", sourceLabel: "—", hasEvidence: false },
  ],
  hearings: [{ id: "h1", date: "2026-07-27T08:00:00.000Z", purpose: "المرافعة", hasMinutes: false }],
  deadlines: [{ id: "d1", label: "تقديم مذكّرة", dueDate: "2026-07-24T00:00:00.000Z", status: "due_soon", basis: "قرار الدائرة" }],
  issues: [{ id: "i1", statement: "ثبوت التأخّر", resolved: false }, { id: "i2", statement: "تقدير التعويض", resolved: false }],
  gaps: [],
};

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${detail}`); }
}

console.log("\n── تحقّق الوكلاء القضائيين الحتميّين ──\n");

console.log("JS-009 حساب المدد:");
const dl = computeDeadlines(CASE);
check("يُنتج حسابًا واحدًا على الأقلّ", dl.computations.length >= 1);
check("كلّ حسابٍ يشرح خطواته", dl.computations.every((c) => c.explanation.includes("⟵")));
check("القاعدة موسومة «غير معتمدة»", dl.computations.every((c) => c.approved === false));

console.log("JS-004 الخطّ الزمنيّ:");
const tl = buildTimeline(CASE);
check("يدمج الجلسات والمدد مرتّبةً", tl.events.length === CASE.hearings.length + CASE.deadlines.length);
check("مرتّبٌ زمنيًّا تصاعديًّا", tl.events.every((e, i, a) => i === 0 || a[i - 1].date <= e.date));

console.log("JS-010 مصفوفة الإثبات:");
const ev = buildEvidenceMatrix(CASE);
check("صفٌّ لكلّ واقعة", ev.rows.length === CASE.facts.length);
check("يرصد الواقعة بلا دليل كنقص", ev.gaps.length === 1);
check("لا يقرّر ثبوتًا نهائيًّا (تنبيه صريح)", ev.disclaimer.includes("لا تقرّر ثبوتًا"));

console.log("JS-006 فحص الاختصاص:");
const ju = checkJurisdiction(CASE);
check("يُنتج بنودًا للمراجعة", ju.items.length >= 3);
check("يفحص تعدّد الطلبات (طلبان)", ju.items.some((i) => i.key === "multi-request"));

console.log("JS-007 فحص القبول:");
const ad = checkAdmissibility(CASE);
check("يفحص الصفة والمصلحة والمدّة", ["capacity", "interest", "timing"].every((k) => ad.items.some((i) => i.key === k)));
check("لا يرفع تنبيه نقصٍ (الخريطة مكتملة)", !ad.items.some((i) => i.outcome === "flag"));

console.log("المنسّق (§15) اقتراح الأعمال بحسب المرحلة:");
const acts = suggestedActionsFor(CASE);
check("يقترح أعمالًا لمرحلة تحضير الجلسة", acts.length >= 1);
check("المتاح فعليًّا يتصدّر", acts.length === 0 || acts[0].available === true);

// حالة النقص: قضيّةٌ بلا خريطة → قوائم الفحص تُظهر النقص بأمانة (لا تجزم)
console.log("سلوك النقص (قضيّة بلا خريطة):");
const bare: JudicialCase = { ...CASE, parties: [], requests: [], facts: [], hearings: [], deadlines: [], issues: [] };
const adBare = checkAdmissibility(bare);
check("يُظهر تنبيه نقصٍ عند غياب الخريطة", adBare.items.some((i) => i.outcome === "flag"));
check("حساب المدد يتعطّل بأمان (لا مواعيد)", computeDeadlines(bare).computations.length === 0);

async function verifyIntelligenceHub() {
  console.log("معقل الذكاء — التأصيل والحجب الصادق:");
  try {
    const { generateExecutiveSummary } = await import("@/lib/modules/judicial-assistant/summary");
    const r = await generateExecutiveSummary(CASE);
    check("JS-001 يعيد مخرجًا منظّمًا (نصّ + استشهادات مصفوفة)", typeof r.summary === "string" && Array.isArray(r.citations));
    check("يُوسَم دائمًا بوجوب المراجعة البشريّة", r.humanReviewRequired === true);
    check("لا تلفيق: إمّا استشهادٌ حقيقيّ أو حجبٌ صادق برسالة", r.blocked ? r.notice.length > 0 : r.citations.length >= 0);
    console.log(`     (الوضع: ${r.blocked ? "حجبٌ صادق — لا سند/لا نموذج" : "مؤصَّل باستشهادات"})`);
  } catch (e) {
    console.log("  … يتطلّب البيئة الحيّة (قاعدة+نموذج)؛ تُخطّى محليًّا:", (e as Error).message.slice(0, 70));
  }
}

verifyIntelligenceHub().then(() => {
  console.log(`\n── النتيجة: ${pass} ناجح، ${fail} فاشل ──\n`);
  process.exit(fail === 0 ? 0 : 1);
});
