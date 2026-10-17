// HKM-012 — قرار المالك (17/10/2026): المتدرّب يرى نص الحكم كاملًا، وتُحجب له أسماء الأفراد فوق حجب
// الهوية والجوال والآيبان والبريد. بقية الأدوار: حجب الأرقام والبريد فقط. النص المخزَّن لا يُمس.
import { maskPersonalData } from "../../rulings/research/mask";
import { redactPII } from "./rulings-search";

/** هل تُحجب أسماء الأطراف لهذا الدور؟ */
export const masksRulingNames = (role: string | null | undefined): boolean => role === "TRAINEE";

/**
 * زر «تحميل بالنقاط» للمشترك وحده (HKM-023-A ل٣-٤ / ع-٤): الأدمن والسوبر أدمن لا يشترون بالنقاط
 * ما يديرونه، فلا يظهر لهما. كان الزر يُعرض لكل دور بلا شرط.
 */
export const showsPointsDownload = (role: string | null | undefined): boolean => role !== "SUPER_ADMIN" && role !== "SYSTEM_ADMIN";

/** نص الحكم كما يُعرض لهذا الدور. */
export function rulingDisplayText(text: string | null | undefined, role: string | null | undefined): string {
  return masksRulingNames(role) ? maskPersonalData(text) : redactPII(text ?? "");
}
