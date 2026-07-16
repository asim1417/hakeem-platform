// ─────────────────────────────────────────────────────────────────────────────
// المظانّ (المرحلة ٤) — تحديد مواضع الحكم: الأنظمة الحاكمة للمسألة وترتيبها.
// القاعدة الأصولية: **الخاصّ يُقدَّم على العامّ**. يمرّر معامل التخصّص (تجاري/جزائي/مدني/أحوال).
// حتمي (يشتقّ من الأنظمة الظاهرة في نتائج التخريج) فيُختبَر بلا نموذج ولا قاعدة.
// ─────────────────────────────────────────────────────────────────────────────
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

export type Specialization = "commercial" | "criminal" | "civil" | "personal_status" | "labor" | "unknown";

export interface GoverningSystem {
  systemName: string;
  score: number;
  scope: "special" | "general";
  articleCount: number;
}

// أنظمة عامّة (تُؤخَّر عند وجود خاصّ يحكم المسألة).
const GENERAL_SYSTEMS = ["المعاملات المدنية", "المرافعات", "الإجراءات"];
// دلالات التخصّص → كلمات في اسم النظام تُرجّحه عند مطابقة تخصّص المسألة.
const SPEC_MARKERS: Record<Exclude<Specialization, "unknown">, string[]> = {
  commercial: ["تجاري", "شركات", "إفلاس", "منافسة", "أوراق تجارية", "علامات"],
  criminal: ["جزائي", "جرائم", "عقوبات", "مخدرات", "رشوة", "تحرش", "معلوماتية"],
  civil: ["مدني", "معاملات", "إيجار", "ملكية", "تمويل عقاري"],
  personal_status: ["أحوال شخصية", "توثيق", "ولاية", "حضانة"],
  labor: ["العمل", "تأمينات", "عمالي"],
};

function isGeneral(name: string): boolean {
  return GENERAL_SYSTEMS.some((g) => name.includes(g));
}

/**
 * يرتّب الأنظمة الحاكمة من نتائج التخريج: تكرار الظهور + ترجيح التخصّص + تقديم الخاصّ على العامّ.
 */
export function rankGoverningSystems(articles: LegalCoreResult[], specialization: Specialization = "unknown"): GoverningSystem[] {
  const freq = new Map<string, number>();
  for (const a of articles) {
    const name = (a.systemName ?? "").trim();
    if (name) freq.set(name, (freq.get(name) ?? 0) + 1);
  }
  const specWords = specialization !== "unknown" ? SPEC_MARKERS[specialization] : [];

  const ranked = [...freq.entries()].map(([systemName, articleCount]) => {
    const general = isGeneral(systemName);
    const specHit = specWords.some((w) => systemName.includes(w));
    // الخاصّ يُقدَّم على العامّ: وزن أساس أعلى لغير العامّ، + ترجيح التخصّص، + التكرار.
    const score = (general ? 0.4 : 1) + (specHit ? 0.8 : 0) + Math.min(articleCount, 10) * 0.05;
    return { systemName, score: Math.round(score * 1000) / 1000, scope: general ? ("general" as const) : ("special" as const), articleCount };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

/** يستنتج تخصّص المسألة من نصّها (حتمي، خفيف). */
export function inferSpecialization(text: string): Specialization {
  const t = text || "";
  for (const [spec, words] of Object.entries(SPEC_MARKERS) as Array<[Exclude<Specialization, "unknown">, string[]]>) {
    if (words.some((w) => t.includes(w))) return spec;
  }
  return "unknown";
}
