/** نوع العمل من عنوانه الرسمي، أو من العمود إن وُجد لاحقًا. لا يُكتب على السجل. */

export const WORK_KINDS = ["نظام", "تنظيم", "ترتيبات", "لائحة", "سياسة", "استراتيجية", "قواعد"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export function kindFromTitle(name: string): WorkKind | null {
  const n = String(name ?? "").trim();
  if (n.startsWith("السياسة") || n.startsWith("سياسة")) return "سياسة";
  if (n.startsWith("الاستراتيجية") || n.startsWith("استراتيجية")) return "استراتيجية";
  if (n.startsWith("الترتيبات") || n.startsWith("ترتيبات")) return "ترتيبات";
  if (n.startsWith("اللائحة") || n.startsWith("لائحة")) return "لائحة";
  if (n.startsWith("قواعد")) return "قواعد";
  if (n.startsWith("تنظيم")) return "تنظيم";
  if (n.startsWith("نظام")) return "نظام";
  return null;
}

export function resolveWorkKind(name: string, stored: string | null | undefined): WorkKind | null {
  const explicit = WORK_KINDS.find((k) => k === String(stored ?? "").trim());
  return explicit ?? kindFromTitle(name);
}

/** عدّاد الأنظمة يستبعد السياسة والاستراتيجية. */
export function countsAsStatute(kind: WorkKind | null): boolean {
  return kind !== "سياسة" && kind !== "استراتيجية";
}
