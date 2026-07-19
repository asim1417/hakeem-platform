// ─────────────────────────────────────────────────────────────────────────────
// قوائم فحصٍ حتميّة إضافيّة: JS-008 (الإجراءات)، JS-019 (المنطوق §54)، JS-020 (جودة الحكم §55)،
// JS-024 (قائمة عمل القاضي للقضية). كلّها مراجعةٌ للقاضي لا حكمٌ آليّ، مبنيّةٌ من بيانات القضية.
// ─────────────────────────────────────────────────────────────────────────────
import { formatDate } from "../labels";
import type { ChecklistItem, ChecklistResult, JudicialCase } from "../types";

const DISC = "قائمة مراجعةٍ لا حكمٌ آليّ، مبنيّةٌ من بيانات القضية.";

/** JS-008 — تحليل الإجراءات: تسلسل الأحداث والمخالفات المحتملة والإجراء التالي. */
export function analyzeProcedure(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [];
  const missing: string[] = [];
  const events = [
    ...kase.hearings.map((h) => ({ date: h.date, label: `جلسة: ${h.purpose}` })),
    ...kase.deadlines.map((d) => ({ date: d.dueDate, label: `مدّة: ${d.label}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) { items.push({ key: "no-events", question: "لا أحداث إجرائيّة في الخريطة.", outcome: "missing", note: "أضِف جلسات/مدد أو استخلِص الخريطة." }); missing.push("لا أحداث إجرائيّة."); }
  else events.forEach((e, i) => items.push({ key: `ev-${i}`, question: `${formatDate(e.date)} — ${e.label}`, outcome: "review", note: "تحقّق من صحّة الإجراء وأثره." }));

  const overdue = kase.deadlines.filter((d) => d.status === "overdue");
  if (overdue.length) items.push({ key: "overdue", question: `مددٌ متأخّرة (${overdue.length}) — أثرها الإجرائيّ؟`, outcome: "flag", note: overdue.map((d) => d.label).join("، ") });

  return { serviceId: "JS-008", deterministic: true, title: "تحليل الإجراءات", items, missing, disclaimer: DISC };
}

/** JS-019 — فحص المنطوق (§54): الأطراف/المحل/المقدار/الزمن/الاتساق/التنفيذ. */
export function checkOperative(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [
    { key: "parties", question: "الأطراف: هل حُدِّد الملزَم والمستفيد بوضوح؟", outcome: kase.parties.length ? "review" : "missing", note: kase.parties.length ? "" : "لا أطراف في الخريطة." },
    { key: "object", question: "المحل: هل محلّ الالتزام محدَّد؟", outcome: "review", note: "استوحِ من الطلبات." },
    { key: "amount", question: "المقدار: هل المبلغ/الكمّيّة صحيحة ومحدّدة؟", outcome: "review", note: "تحقّق من الأرقام في المرفقات." },
    { key: "time", question: "الزمن: هل يلزم أجلٌ أو تاريخٌ للتنفيذ؟", outcome: "review", note: "" },
    { key: "consistency", question: "الاتساق: هل يطابق المنطوق الأسباب والطلبات؟", outcome: "review", note: "قارن مع JS-017/JS-018." },
    { key: "enforce", question: "التنفيذ: هل يمكن تنفيذه دون تفسيرٍ جوهريّ؟", outcome: "review", note: "" },
  ];
  const missing = kase.parties.length ? [] : ["لا أطراف (لفحص تحديد الملزَم/المستفيد)."];
  return { serviceId: "JS-019", deterministic: true, title: "فحص المنطوق", items, missing, disclaimer: DISC };
}

/** JS-020 — فحص جودة الحكم (§55): قائمة تدقيقٍ شكليّة وموضوعيّة. */
export function checkQuality(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [
    { key: "form", question: "الشكل والبيانات: رقم القضية والمحكمة والأطراف مكتملة؟", outcome: kase.court && kase.parties.length ? "review" : "missing", note: kase.court ? "" : "بياناتٌ ناقصة في الرأس." },
    { key: "jurisdiction", question: "الاختصاص والقبول: فُحِصا (JS-006/007)؟", outcome: "review", note: "شغّل JS-006 وJS-007." },
    { key: "requests", question: "عرض الطلبات والدفوع: مكتمل؟", outcome: kase.requests.length ? "review" : "missing", note: kase.requests.length ? "" : "لا طلبات في الخريطة." },
    { key: "facts", question: "تحرير الوقائع: منسوبةٌ ومحرّرة؟", outcome: "review", note: "قارن مع JS-016." },
    { key: "evidence", question: "الإثبات والعبء: عولِج (JS-010)؟", outcome: "review", note: "" },
    { key: "reasoning", question: "منطق التسبيب: متسلسلٌ ومترابط؟", outcome: "review", note: "قارن مع JS-017." },
    { key: "operative", question: "اتساق الأسباب والمنطوق وقابليّة التنفيذ (JS-019)؟", outcome: "review", note: "" },
    { key: "names", question: "الأسماء والمبالغ والتواريخ: صحيحة؟", outcome: "review", note: "تحقّق دقيق." },
  ];
  const missing: string[] = [];
  if (!kase.court || !kase.parties.length) missing.push("بيانات الرأس/الأطراف ناقصة.");
  if (!kase.requests.length) missing.push("لا طلبات في الخريطة.");
  return { serviceId: "JS-020", deterministic: true, title: "فحص جودة الحكم", items, missing, disclaimer: DISC };
}

/** JS-024 — قائمة عمل القاضي لهذه القضية: المعلّقات مرتّبةً بالأولويّة. */
export function buildTaskList(kase: JudicialCase): ChecklistResult {
  const items: ChecklistItem[] = [];
  for (const d of kase.deadlines.filter((x) => x.status === "overdue")) items.push({ key: `od-${d.id}`, question: `مدّة متأخّرة: ${d.label} (${formatDate(d.dueDate)})`, outcome: "flag", note: d.basis });
  for (const d of kase.deadlines.filter((x) => x.status === "due_soon")) items.push({ key: `ds-${d.id}`, question: `مدّة تقترب: ${d.label} (${formatDate(d.dueDate)})`, outcome: "review", note: d.basis });
  for (const h of kase.hearings) items.push({ key: `h-${h.id}`, question: `جلسة: ${h.purpose} (${formatDate(h.date)})`, outcome: "review", note: h.hasMinutes ? "يوجد محضر" : "لا محضر بعد" });
  for (const i of kase.issues.filter((x) => !x.resolved)) items.push({ key: `is-${i.id}`, question: `مسألة مفتوحة: ${i.statement}`, outcome: "review", note: "تحتاج فصلًا." });
  const missing: string[] = [];
  if (kase.attachments.length === 0) missing.push("لا مرفقات — ابدأ برفع وثائق القضية.");
  if (kase.parties.length + kase.issues.length === 0) missing.push("الخريطة فارغة — استخلِصها (JS-005).");
  if (items.length === 0 && missing.length === 0) items.push({ key: "clear", question: "لا معلّقاتٌ عاجلة.", outcome: "review", note: "" });
  return { serviceId: "JS-024", deterministic: true, title: "قائمة عملك في القضية", items, missing, disclaimer: DISC };
}
