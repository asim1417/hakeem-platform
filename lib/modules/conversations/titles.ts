/**
 * توليد عنوان جلسة قصير (4–8 كلمات مفيدة) من أول طلب.
 * لا يعتمد على نموذج ذكاء — قواعد نصية فقط (بلا تغيير لمنطق الإجابة).
 */

const FALLBACK: Record<string, string> = {
  ask: "جلسة جديدة",
  "judicial-assistant": "جلسة معاون",
  "legal-chat": "محادثة قانونية",
};

function stripNoise(input: string): string {
  return input
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** يولد عنوانًا من 4–8 كلمات؛ يسقط للاحتياطي إن فشل. */
export function generateConversationTitle(
  firstUserText: string,
  serviceKey: string
): string {
  const cleaned = stripNoise(firstUserText);
  if (!cleaned || cleaned.length < 3) {
    return FALLBACK[serviceKey] ?? "جلسة جديدة";
  }
  // رفض إن لم توجد حروف لغوية (يدعم العربية) أو كان قصيرًا جدًا
  if (!/\p{L}/u.test(cleaned) || cleaned.length < 3) {
    return FALLBACK[serviceKey] ?? "جلسة جديدة";
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  const n = Math.min(8, Math.max(4, words.length));
  const slice = words.slice(0, Math.min(n, words.length));
  // إن قلّت الكلمات عن 4 نستخدم المتاح دون رفض إن وُجدت حروف
  let title = slice.join(" ");
  if (words.length > slice.length) title = `${title}…`;
  if (title.length < 3 || !/\p{L}/u.test(title)) return FALLBACK[serviceKey] ?? "جلسة جديدة";
  return title.slice(0, 120);
}

export function assertRenamableTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t.length < 2) throw new Error("عنوان قصير جدًا.");
  if (!/\p{L}/u.test(t)) throw new Error("العنوان يجب أن يحتوي كلمات مفهومة.");
  return t.slice(0, 120);
}
