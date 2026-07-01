/**
 * حالة المادة (نظير Citator): تحويل قيمة الحالة الخام إلى شارة عربية موحّدة عبر الواجهات.
 * تُعرض فقط عند توفّر قيمة **معروفة** — القيم غير المعروفة تُعيد null فلا تُعرض شارة،
 * تفادياً للتضليل. المعالجة الكاملة للحالة (من التعديلات/المراسيم) على خارطة الطريق.
 */
export type StatusTone = "emerald" | "amber" | "ruby";

export function articleStatusBadge(status: string | null | undefined): { label: string; tone: StatusTone } | null {
  if (!status) return null;
  const s = status.trim().toUpperCase();
  if (["ACTIVE", "IN_FORCE", "VALID", "سارية", "سار", "نافذ", "نافذة"].includes(s)) return { label: "سارية", tone: "emerald" };
  if (["AMENDED", "MODIFIED", "معدلة", "معدّلة", "معدل"].includes(s)) return { label: "معدّلة", tone: "amber" };
  if (["REPEALED", "CANCELLED", "CANCELED", "منسوخة", "ملغاة", "ملغي"].includes(s)) return { label: "منسوخة", tone: "ruby" };
  if (["SUSPENDED", "موقوفة", "معلقة"].includes(s)) return { label: "موقوفة", tone: "amber" };
  return null;
}
