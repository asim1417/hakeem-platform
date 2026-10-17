// HKM-028: مفتاح المادة ووسمها مع درجة «مكرر». المفتاح «20» أو «20_bis» (كـart_N_bis في hkn-uri).

/**
 * درجة «مكرر» من 100 فأعلى علامة صفٍّ ليس مادة (عنوان، جدول ملحق، نسخة مكررة) يبقى في الجدول ولا يُعرض
 * ولا يُستشهد به. الأرقام السالبة يمنعها القيد legal_articles_article_number_positive.
 */
export const NON_ARTICLE_BIS = 100;

/** شرط Prisma: صفوف المواد فقط. */
export const ARTICLE_ROWS = { articleBis: { lt: NON_ARTICLE_BIS } } as const;

/** مفتاح الرابط: «20» للأصل، «20_bis» لـ«مكرر»، «20_bis2» لـ«مكرر مرتين». */
export function articleKey(n: number, bis = 0): string {
  return bis > 0 ? `${n}_bis${bis > 1 ? bis : ""}` : String(n);
}

/** وسم العرض: «20» أو «20 مكرر» (وبالأرقام العربية الهندية عند الطلب). */
export function articleLabel(n: number, bis = 0, arabicDigits = false): string {
  const num = arabicDigits ? n.toLocaleString("ar-SA") : String(n);
  return bis > 0 ? `${num} مكرر${bis > 1 ? ` ${bis}` : ""}` : num;
}
