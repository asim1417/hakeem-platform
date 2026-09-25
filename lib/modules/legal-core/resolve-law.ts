/**
 * resolve-law — حلّ اسم النظام القانونيّ إلى سجلّ LegalSystem بثبات (البند 1.1 من خطة الإصلاح).
 *
 * الاستراتيجية:
 *   1) تطبيع الاسم (إسقاط التشكيل والتطويل، توحيد الهمزات والتاء المربوطة والألف المقصورة،
 *      إزالة سنة ملتصقة مثل «1443هـ»، وعلامات الترقيم، وتوحيد المسافات).
 *   2) مطابقة تامّة على الاسم المطبَّع.
 *   3) وإلّا أطول بادئة (اسم النظام يبدأ بالمُدخَل أو العكس) — يُفضَّل الأطول ثمّ الأكبر مادةً.
 *   4) وإلّا احتواء.
 *   • تُستبعد اللوائح التنفيذية ما لم يطلبها المُدخَل صراحةً أو تُمرَّر includeBylaws.
 *   • «تفضيل النافذ»: عند التعادل يُقدَّم النظام الأصل (أكبر عدد مواد) لا اللائحة.
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabic } from "./bm25-tokenizer";

export function normalizeSystemName(input: string | null | undefined): string {
  // normalizeArabic يُسقط التشكيل/التطويل ويوحّد الهمزات/التاء/الألف المقصورة ويحوّل الأرقام
  // الهندية إلى لاتينية ويزيل الترقيم. نزيل بعدها السنة الملتصقة (مثل 1443/1443هـ).
  return normalizeArabic(String(input ?? ""))
    .replace(/لسنه/g, " ")
    .replace(/\d{3,4}\s*[هم]?/g, " ") // سنة ملتصقة مع علامة هجريّة/ميلاديّة (هـ→ه بعد التطبيع)
    .replace(/\s+/g, " ")
    .trim();
}

// ملاحظة: \b لا يعمل مع الحروف العربية في JS، فنستخدم (?:\s|$) للحدّ بعد كلمة اللائحة.
const BYLAW_RE = /^(?:اللائحه|لائحه|القواعد|الضوابط|الدليل|اللايحه)(?:\s|$)/;
export function isBylawName(normalized: string): boolean {
  return BYLAW_RE.test(normalized);
}

export interface ResolvedLaw {
  system: { id: string; name: string; articleCount: number };
  matchType: "exact" | "prefix" | "contains";
}

export async function resolveLaw(
  input: string,
  opts: { includeBylaws?: boolean } = {},
): Promise<ResolvedLaw | null> {
  const q = normalizeSystemName(input);
  if (!q) return null;
  const wantsBylaw = opts.includeBylaws === true || isBylawName(q);

  const systems = await prisma.legalSystem
    .findMany({ select: { id: true, name: true, articleCount: true } })
    .catch(() => [] as Array<{ id: string; name: string; articleCount: number }>);

  const cand = systems
    .map((s) => ({ s, n: normalizeSystemName(s.name) }))
    .filter((x) => x.n.length > 0 && (wantsBylaw || !isBylawName(x.n)));

  // ① مطابقة تامّة.
  const exact = cand.filter((x) => x.n === q);
  if (exact.length) {
    exact.sort((a, b) => b.s.articleCount - a.s.articleCount);
    return { system: exact[0].s, matchType: "exact" };
  }

  // ② أطول بادئة (في الاتجاهين) — الأطول ثمّ الأكبر مادةً (تفضيل النافذ/الأصل).
  const prefix = cand.filter((x) => x.n.startsWith(q) || q.startsWith(x.n));
  if (prefix.length) {
    prefix.sort((a, b) => b.n.length - a.n.length || b.s.articleCount - a.s.articleCount);
    return { system: prefix[0].s, matchType: "prefix" };
  }

  // ③ احتواء.
  const contains = cand.filter((x) => x.n.includes(q) || q.includes(x.n));
  if (contains.length) {
    contains.sort((a, b) => b.s.articleCount - a.s.articleCount);
    return { system: contains[0].s, matchType: "contains" };
  }

  return null;
}
