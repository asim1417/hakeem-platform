// ─────────────────────────────────────────────────────────────────────────────
// JS-006 فحص الاختصاص + JS-007 فحص القبول — قوائم فحصٍ إجرائيّة حتميّة (§16، §18).
// المخرَج **قائمة مراجعةٍ للقاضي** لا حكمٌ آليّ: أيّ الأسئلة تلزم، وأيّ البيانات ناقصة.
// حتميٌّ من بيانات القضية، بلا نصٍّ نظاميّ مُختلق (الأسئلة عامّة إجرائيّة يجيب عنها القاضي).
// ─────────────────────────────────────────────────────────────────────────────
import { JURISDICTION_LABEL } from "../labels";
import type { ChecklistItem, ChecklistResult, JudicialCase } from "../types";

const DISCLAIMER =
  "قائمة فحصٍ للمراجعة لا حكمٌ آليّ. تُبنى من بيانات القضية؛ الأساس النظاميّ لكلّ شرطٍ يُراجَع من النواة قبل الاعتماد.";

/** JS-006 — فحص الاختصاص (نوعيّ/مكانيّ/ولائيّ). */
export function checkJurisdiction(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [];
  const missing: string[] = [];

  items.push({
    key: "subject-matter",
    question: `الاختصاص النوعيّ: هل موضوع الدعوى «${kase.subject}» من اختصاص قضاء ${JURISDICTION_LABEL[kase.jurisdiction]}؟`,
    outcome: "review",
    note: "يُقارَن نوع الطلب بالاختصاص النوعيّ للقضاء.",
  });

  if (kase.court) {
    items.push({ key: "territorial", question: `الاختصاص المكانيّ: هل ${kase.court} مختصّةٌ مكانيًّا بالنزاع؟`, outcome: "review", note: "موطن المدّعى عليه/محلّ العقد/محلّ التنفيذ." });
  } else {
    items.push({ key: "territorial", question: "الاختصاص المكانيّ: تحديد المحكمة المختصّة مكانيًّا.", outcome: "missing", note: "لم تُحدَّد المحكمة." });
    missing.push("المحكمة غير محدّدة (لفحص الاختصاص المكانيّ).");
  }

  items.push({ key: "jurisdiction-vs-other", question: "الاختصاص الوَلائيّ: هل الدعوى من ولاية القضاء لا جهةٍ أخرى؟", outcome: "review", note: "استبعاد اختصاص جهةٍ إداريّة/لجنةٍ متخصّصة." });

  if (kase.requests.length > 1) {
    items.push({ key: "multi-request", question: `تعدّد الطلبات (${kase.requests.length}): هل تدخل جميعها في اختصاص هذا القضاء؟`, outcome: "review", note: "قد يستلزم تعدّد الطلبات فحص الارتباط والاختصاص لكلٍّ." });
  }
  if (kase.requests.length === 0) missing.push("لا طلبات في الخريطة (استخلِص الخريطة أو أضِفها لفحصٍ أدقّ).");

  return { serviceId: "JS-006", deterministic: true, title: "فحص الاختصاص", items, missing, disclaimer: DISCLAIMER };
}

/** JS-007 — فحص القبول (الصفة/المصلحة/المدّة/انعقاد الخصومة). */
export function checkAdmissibility(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [];
  const missing: string[] = [];

  if (kase.parties.length > 0) {
    items.push({ key: "capacity", question: `الصفة: هل لكلٍّ من الأطراف (${kase.parties.length}) صفةٌ صحيحة في الخصومة؟`, outcome: "review", note: "الأصيل/الوكيل/الوليّ، وصحّة التمثيل." });
  } else {
    items.push({ key: "capacity", question: "الصفة: تحديد أطراف الخصومة وصفاتهم.", outcome: "missing", note: "لا أطراف في الخريطة." });
    missing.push("لا أطراف (استخلِص الخريطة لتحديد الصفة).");
  }

  items.push({ key: "interest", question: "المصلحة: هل للمدّعي مصلحةٌ قائمةٌ ومشروعة؟", outcome: "review", note: "المصلحة شرط قبول الدعوى." });

  const hasDates = kase.deadlines.length > 0 || kase.hearings.length > 0;
  items.push({
    key: "timing",
    question: "المدّة: هل رُفعت الدعوى/الطلب داخل المدّة النظاميّة؟",
    outcome: hasDates ? "review" : "missing",
    note: hasDates ? "يُحسَب من الحدث الموثّق (انظر JS-009)." : "لا تواريخ في الخريطة لحساب المدّة.",
  });
  if (!hasDates) missing.push("لا أحداث/مدد لحساب المواعيد (JS-009).");

  items.push({ key: "litis", question: "انعقاد الخصومة: هل صحّت إجراءات المخاصمة والإعلان؟", outcome: "review", note: "صحّة التبليغ وحضور الخصوم." });

  const flagged = items.some((i) => i.outcome === "missing");
  if (flagged) items.unshift({ key: "gap", question: "تنبيه: بياناتٌ ناقصة قد تمنع الجزم بالقبول.", outcome: "flag", note: "أكمِل الخريطة أولًا." });

  return { serviceId: "JS-007", deterministic: true, title: "فحص القبول", items, missing, disclaimer: DISCLAIMER };
}
