import { normalizeArabicText } from "./arabic-morphology";

/** حقول المادة التي تدخل عمود البحث. نفس التركيب الذي تستخدمه إعادة الفهرسة العامة. */
export type SearchNormSource = {
  lawName: string;
  title: string;
  content: string;
  keywords: string[] | null;
  classification: string | null;
  chapter: string | null;
};

/** نص البحث المُطبَّع: اسم النظام، العنوان، المتن، الكلمات، التصنيف، الفصل. */
export function buildSearchNorm(article: SearchNormSource): string {
  const raw = [
    article.lawName,
    article.title,
    article.content,
    (article.keywords ?? []).join(" "),
    article.classification ?? "",
    article.chapter ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return normalizeArabicText(raw);
}
