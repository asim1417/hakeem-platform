// تسميات عربيّة مشتركة (خادم/عميل) — تمنع تسرّب القيم البرمجيّة الخام إلى الواجهة (§ملاحظة الجرد).
import type { Confidentiality, DeadlineStatus, FactStatus, Jurisdiction } from "./types";

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  general: "عامّ",
  commercial: "تجاريّ",
  criminal: "جزائيّ",
  administrative: "إداريّ",
  labor: "عمّاليّ",
};

export const CONFIDENTIALITY_LABEL: Record<Confidentiality, string> = {
  normal: "عاديّة",
  restricted: "مقيّدة",
  secret: "سرّيّة",
};

export const FACT_STATUS_LABEL: Record<FactStatus, string> = {
  alleged: "مُدّعاة",
  admitted: "مُقرّة",
  denied: "منكَرة",
  established: "ثابتة",
  unresolved: "غير محسومة",
};

/** نغمة حالة الواقعة للعرض — ثابتة ≈ نجاح، منكَرة/غير محسومة ≈ تنبيه. */
export const FACT_STATUS_TONE: Record<FactStatus, "success" | "info" | "warning" | "danger"> = {
  established: "success",
  admitted: "success",
  alleged: "info",
  denied: "warning",
  unresolved: "warning",
};

export const DEADLINE_STATUS_LABEL: Record<DeadlineStatus, string> = {
  upcoming: "قادمة",
  due_soon: "تقترب",
  overdue: "متأخّرة",
  met: "مُستوفاة",
};

export const DEADLINE_STATUS_TONE: Record<DeadlineStatus, "success" | "info" | "warning" | "danger"> = {
  upcoming: "info",
  due_soon: "warning",
  overdue: "danger",
  met: "success",
};

/** تنسيق تاريخ ISO ثابت إلى صيغةٍ عربيّة قصيرة (بلا وقتٍ للعرض اليوميّ). */
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
