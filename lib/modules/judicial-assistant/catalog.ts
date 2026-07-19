// ─────────────────────────────────────────────────────────────────────────────
// كتالوج الأعمال، خريطة الأيقونات، وبيانات المراحل — المعاون القضائي.
// المرجع: المواصفة النهائية v2.0 (§14 المراحل، §15 الاقتراح السياقيّ، §16 الخدمات، §24 الأيقونات).
// المنسّق يقترح حزمة أعمالٍ بحسب المرحلة، ولا ينفّذ كلّ الوكلاء في كلّ مرّة (§15).
// ─────────────────────────────────────────────────────────────────────────────
import type { CaseStage, ServiceDef, SuggestedAction, JudicialCase } from "./types";

/** كتالوج الخدمات الرسميّ (§16). `available` = منفّذ في هذه المرحلة (الأولى: JS-001 فقط حيًّا). */
export const SERVICES: ServiceDef[] = [
  { id: "JS-001", title: "الملخّص التنفيذيّ", review: "optional", iconKey: "summary", available: true },
  { id: "JS-002", title: "مذكّرة الإحاطة", review: "required", iconKey: "brief", available: false },
  { id: "JS-003", title: "الملخّص التفصيليّ", review: "required", iconKey: "documents", available: false },
  { id: "JS-004", title: "الخطّ الزمنيّ", review: "required", iconKey: "procedure", available: true },
  { id: "JS-005", title: "خريطة القضية", review: "required", iconKey: "map", available: true },
  { id: "JS-006", title: "فحص الاختصاص", review: "mandatory", iconKey: "jurisdiction", available: true },
  { id: "JS-007", title: "فحص القبول", review: "mandatory", iconKey: "admissibility", available: true },
  { id: "JS-008", title: "تحليل الإجراءات", review: "mandatory", iconKey: "procedure", available: false },
  { id: "JS-009", title: "حساب المدد", review: "mandatory", iconKey: "deadline", available: true },
  { id: "JS-010", title: "مصفوفة الإثبات", review: "mandatory", iconKey: "evidence", available: true },
  { id: "JS-011", title: "تحضير جلسة", review: "required", iconKey: "hearing", available: false },
  { id: "JS-012", title: "مقارنة الأقوال", review: "required", iconKey: "contradiction", available: false },
  { id: "JS-013", title: "الدراسة القضائيّة", review: "mandatory", iconKey: "study", available: true },
  { id: "JS-014", title: "مذكّرة مسألة", review: "mandatory", iconKey: "issue", available: false },
  { id: "JS-015", title: "قرار إجرائيّ", review: "mandatory", iconKey: "procedure", available: false },
  { id: "JS-016", title: "صياغة الوقائع", review: "mandatory", iconKey: "drafting", available: false },
  { id: "JS-017", title: "بناء التسبيب", review: "mandatory", iconKey: "reasoning", available: false },
  { id: "JS-018", title: "مشروع الحكم", review: "mandatory", iconKey: "judgment", available: true },
  { id: "JS-019", title: "فحص المنطوق", review: "mandatory", iconKey: "operative", available: false },
  { id: "JS-020", title: "فحص جودة الحكم", review: "mandatory", iconKey: "quality", available: false },
  { id: "JS-021", title: "تحليل الاعتراض", review: "mandatory", iconKey: "appeal", available: false },
  { id: "JS-022", title: "مذكّرة الردّ على الاعتراض", review: "mandatory", iconKey: "appeal", available: false },
  { id: "JS-023", title: "التصدير القضائيّ", review: "optional", iconKey: "export", available: false },
  { id: "JS-024", title: "قائمة عمل القاضي", review: "optional", iconKey: "tasks", available: false },
];

export const SERVICE_BY_ID: Record<string, ServiceDef> = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

/** أسماء المراحل بالعربيّة + شرحٌ مقتضب (§14). */
export const STAGE_META: Record<CaseStage, { label: string; hint: string; index: number }> = {
  imported: { label: "مستورَدة", hint: "استُلمت البيانات الأوليّة", index: 0 },
  ingestion: { label: "جلب الملفّات", hint: "تنزيل الملفّات وفحصها", index: 1 },
  parsed: { label: "تحليل النصّ", hint: "تحويل النصّ والبنية", index: 2 },
  mapped: { label: "خريطة أوليّة", hint: "استخراج الأطراف والطلبات والوقائع", index: 3 },
  review_required: { label: "تحتاج مراجعة", hint: "تثبيت العناصر منخفضة الثقة", index: 4 },
  active: { label: "نشطة", hint: "مساحة عملٍ مكتملة الحدّ الأدنى", index: 5 },
  hearing_preparation: { label: "تحضير جلسة", hint: "جلسةٌ قادمة أو طلبُ تحضير", index: 6 },
  deliberation: { label: "المداولة", hint: "دراسة المسائل قبل الحكم", index: 7 },
  drafting: { label: "الصياغة", hint: "صياغة قرارٍ أو حكم", index: 8 },
  quality_review: { label: "مراجعة الجودة", hint: "فحص المسودّة قبل الاعتماد", index: 9 },
  appeal_review: { label: "تحليل الاعتراض", hint: "دراسة الطعن وأثره", index: 10 },
  closed: { label: "مُغلقة", hint: "إغلاقٌ وأرشفة", index: 11 },
};

/** ترتيب المراحل لشريط التقدّم (يشرح الحالة، لا يوحي بالنتيجة — §21). */
export const STAGE_ORDER: CaseStage[] = [
  "imported", "ingestion", "parsed", "mapped", "review_required",
  "active", "hearing_preparation", "deliberation", "drafting",
  "quality_review", "appeal_review", "closed",
];

/** خريطة المرحلة ← الأعمال المقترحة (§15). لا تُنفَّذ تلقائيًّا؛ تُعرض للقاضي ليختار. */
const STAGE_ACTIONS: Record<CaseStage, Array<{ serviceId: string; reason: string }>> = {
  imported: [
    { serviceId: "JS-001", reason: "بعد الاستيراد: ملخّصٌ أوليّ لاستعادة سياق القضية بسرعة" },
    { serviceId: "JS-005", reason: "بناء خريطة الأطراف والطلبات والوقائع" },
    { serviceId: "JS-003", reason: "فحص الملفّ والملخّص التفصيليّ بحسب المستند" },
  ],
  ingestion: [{ serviceId: "JS-003", reason: "فحص جودة الملفّات المُنزّلة" }],
  parsed: [{ serviceId: "JS-005", reason: "استخراج الخريطة من النصّ المُحلَّل" }],
  mapped: [
    { serviceId: "JS-006", reason: "قبل الجلسة الأولى: التحقّق من الاختصاص" },
    { serviceId: "JS-007", reason: "فحص القبول: الصفة والمصلحة والمدد" },
  ],
  review_required: [{ serviceId: "JS-005", reason: "تثبيت العناصر منخفضة الثقة في الخريطة" }],
  active: [
    { serviceId: "JS-001", reason: "ملخّصٌ تنفيذيّ محدَّث لحالة القضية" },
    { serviceId: "JS-004", reason: "خطٌّ زمنيّ يرتّب الأحداث ويكشف تعارض المواعيد" },
    { serviceId: "JS-009", reason: "التحقّق من المدد الإجرائيّة" },
    { serviceId: "JS-012", reason: "أثناء تبادل المذكّرات: مقارنة الادعاءات والدفوع" },
  ],
  hearing_preparation: [
    { serviceId: "JS-011", reason: "جلسةٌ قريبة: تحضير المحاور والأسئلة والنواقص" },
    { serviceId: "JS-001", reason: "استعادة السياق قبل الجلسة" },
    { serviceId: "JS-004", reason: "الخطّ الزمنيّ للأحداث والمواعيد قبل الجلسة" },
    { serviceId: "JS-009", reason: "حساب مدد ما قبل الجلسة والتحقّق منها" },
  ],
  deliberation: [
    { serviceId: "JS-013", reason: "قبل المداولة: دراسة المسائل والبدائل" },
    { serviceId: "JS-010", reason: "مصفوفة الإثبات والعبء والاعتراضات" },
    { serviceId: "JS-014", reason: "مذكّرة مسألةٍ محدّدة محلّ الفصل" },
  ],
  drafting: [
    { serviceId: "JS-018", reason: "تجميع مشروع الحكم: هيكلٌ حتميّ + تسبيبٌ مؤصَّل + سوابق من النواة" },
    { serviceId: "JS-001", reason: "ملخّصٌ تنفيذيّ للسياق قبل الصياغة" },
    { serviceId: "JS-016", reason: "صياغة الوقائع من المصادر المثبتة" },
    { serviceId: "JS-017", reason: "بناء التسبيب: واقعة-قاعدة-تطبيق" },
  ],
  quality_review: [
    { serviceId: "JS-020", reason: "فحص جودة الحكم قبل الاعتماد" },
    { serviceId: "JS-019", reason: "فحص المنطوق: القابليّة للتنفيذ والاتساق" },
  ],
  appeal_review: [
    { serviceId: "JS-021", reason: "بعد الحكم: تحليل الاعتراض والمدّة والأسباب" },
    { serviceId: "JS-022", reason: "مسودّة الردّ على الاعتراض" },
  ],
  closed: [],
};

/** يبني قائمة الأعمال المقترحة لقضيةٍ بحسب مرحلتها (§15). المتاح فعليًّا أوّلًا. */
export function suggestedActionsFor(kase: JudicialCase): SuggestedAction[] {
  const rows = STAGE_ACTIONS[kase.stage] ?? [];
  const actions = rows.map((r) => {
    const svc = SERVICE_BY_ID[r.serviceId];
    return {
      serviceId: r.serviceId,
      title: svc?.title ?? r.serviceId,
      reason: r.reason,
      iconKey: svc?.iconKey ?? "summary",
      available: svc?.available ?? false,
    };
  });
  // المتاح فعليًّا يتصدّر كي لا يواجه القاضي اقتراحاتٍ غير قابلة للتشغيل بعد.
  return actions.sort((a, b) => Number(b.available) - Number(a.available));
}
