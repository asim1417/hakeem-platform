/**
 * cross-references.ts — استخراج الإحالات الداخلية بين مواد النظام من نصّ المادة.
 *
 * يلتقط إشارات مثل: «وفقًا للمادة (40)»، «مع مراعاة المادة 12»، «المشار إليها
 * في المادة الخامسة»، «المواد 40 و41 و42». استخراج نصّي خالص لا يعدّل النصّ
 * الأصلي ولا يخترع أرقامًا — يُعيد ما ورد صراحةً فقط.
 */
import { normalizeDigits } from "./decree-extractor";

export interface ArticleReference {
  articleNumber: number;
  /** سياق الإشارة كما ورد (لإظهار وجه الإحالة) */
  phrase: string;
}

// جذع كلمة المادة/المواد بأيّ بادئة (المادة، للمادة، بالمادة، المادتين، المواد…).
const REF_MARKER = /ماد(?:ة|تين|تي)|مواد/g;

/**
 * يستخرج أرقام المواد المُحال إليها في النصّ (عدا رقم المادة نفسها).
 * @param text نصّ المادة
 * @param selfNumber رقم المادة الحالية لاستبعاد الإحالة الذاتية
 */
export function extractArticleReferences(text: string | null | undefined, selfNumber?: number): ArticleReference[] {
  if (!text) return [];
  const norm = normalizeDigits(String(text));
  const out = new Map<number, string>();

  let m: RegExpExecArray | null;
  REF_MARKER.lastIndex = 0;
  while ((m = REF_MARKER.exec(norm)) !== null) {
    // نافذة قصيرة بعد كلمة «المادة/المواد» لالتقاط الأرقام المرتبطة بها.
    const window = norm.slice(m.index, m.index + 60);
    const nums = window.match(/\d{1,4}/g);
    if (!nums) continue;
    const phrase = window.split(/[.،؛\n]/)[0].trim().slice(0, 80);
    for (const n of nums) {
      const num = Number(n);
      if (Number.isInteger(num) && num > 0 && num <= 9999 && num !== selfNumber && !out.has(num)) {
        out.set(num, phrase);
      }
    }
  }

  return [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([articleNumber, phrase]) => ({ articleNumber, phrase }));
}
