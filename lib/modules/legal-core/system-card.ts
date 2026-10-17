// بيانات بطاقة النظام في قائمة الأنظمة (HKM-023-A ع-٥). نقيّ.
//
// كانت البطاقة تكتب «تاريخ النفاذ: عند التوفر» لكل نظام خارج الركائز الإحدى عشرة، مع أن legal_systems
// لا عمود فيه لتاريخ النفاذ أصلًا؛ وتعرض «ساري» ثابتًا لكل نظام ولو كان ملغى أو مستبدلًا في سجل التحقق.
// الآن: التاريخ من مصدر مؤكد (الركيزة أو law_card) أو «غير متوفر» صراحةً، والحالة من سجل التحقق
// بتاريخ اليوم (كصفحة النظام العامة) أو «قيد التحقق».
import { formatHijri } from "./core-systems";
import { UNVERIFIED_NOTICE } from "./verified-status";

export const ISSUANCE_UNAVAILABLE = "تاريخ الإصدار: غير متوفر";
export const STATUS_UNVERIFIED_SHORT = "الحالة قيد التحقق";

export type SystemStatusTone = "emerald" | "amber" | "ruby" | "gold";

/** سطر التاريخ: الركيزة أولًا (مصدرها بوابة العدل)، ثم بطاقة الهيئة، وإلا «غير متوفر». لا «عند التوفر». */
export function systemCardDateLine(input: { coreIssuanceH?: string | null; lawCardIssuedHijri?: string | null }): string {
  const core = formatHijri(input.coreIssuanceH ?? null);
  if (core) return `صدر: ${core}`;
  const card = input.lawCardIssuedHijri?.trim();
  if (card) return `صدر: ${formatHijri(card)}`;
  return ISSUANCE_UNAVAILABLE;
}

/** شارة الحالة من التسمية المشتقة (citationFlagsFromVerification ثم workStatusAsOf). */
export function systemCardStatus(statusLabel: string): { label: string; tone: SystemStatusTone } {
  if (!statusLabel || statusLabel === UNVERIFIED_NOTICE) return { label: STATUS_UNVERIFIED_SHORT, tone: "gold" };
  if (statusLabel === "ساري") return { label: "ساري", tone: "emerald" };
  if (statusLabel === "ملغى" || statusLabel === "مستبدل" || statusLabel === "ملغاة") return { label: statusLabel, tone: "ruby" };
  return { label: statusLabel, tone: "amber" };
}
