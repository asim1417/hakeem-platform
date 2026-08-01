// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §12 — قاموس العبارات القانونيّة السعوديّة (تلميحاتٌ خادميّة).
// مصطلحاتٌ يصعب على التفريغ العامّ ضبطها. لا أسماء أطراف، لا هويّات، لا نصّ مرفقات.
// ─────────────────────────────────────────────────────────────────────────────

/** قائمةٌ أساسيّة ثابتة (تُمرَّر كـ hints للمزوّد). */
export const BASE_LEGAL_PHRASES: readonly string[] = [
  "المدعي",
  "المدعى عليه",
  "المستأنِف",
  "المستأنَف ضده",
  "محكمة الاستئناف",
  "محكمة التنفيذ",
  "نظام الإثبات",
  "نظام المعاملات المدنية",
  "نظام المرافعات الشرعية",
  "صحيفة الدعوى",
  "لائحة اعتراضية",
  "مذكرة جوابية",
  "منطوق الحكم",
  "أسباب الحكم",
  "الصفة والمصلحة",
  "حجية الأمر المقضي",
  "وقف التنفيذ",
  "طالب التنفيذ",
  "المنفَّذ ضده",
  "السند التنفيذي",
  "يمين متممة",
  "قرينة",
  "بيّنة",
  "اختصاص نوعي",
  "اختصاص مكاني",
  "عدم قبول الدعوى",
  "صرف النظر",
  "نقض الحكم",
  "تأييد الحكم",
] as const;

/** تنقيةٌ محافظة: يمنع تسرّب بياناتٍ حسّاسة إلى قائمة التلميحات (لا أرقام هويّة/جوّال). */
export function sanitizeHints(extra: readonly string[]): string[] {
  const banned = /\b\d{6,}\b/; // أرقامٌ طويلة (هويّة/جوّال/حساب)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of extra) {
    const t = (raw ?? "").trim();
    if (!t || t.length < 2 || t.length > 60) continue;
    if (banned.test(t)) continue;
    const key = t.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * يبني قائمة التلميحات النهائيّة: الأساس + إضافاتٌ مُنقّاة (أسماء أنظمة/محاكم من النواة مثلًا)،
 * مُقتطعة لحدٍّ آمن. لا يُرسَل أيّ شيءٍ خارج المصطلحات المسموح بها.
 */
export function buildLegalHints(extra: readonly string[] = [], limit = 120): string[] {
  const merged = [...BASE_LEGAL_PHRASES, ...sanitizeHints(extra)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of merged) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}
