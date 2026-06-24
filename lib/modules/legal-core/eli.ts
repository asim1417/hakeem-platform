/**
 * eli.ts — معرّف تشريعي ثابت بنمط ELI (European Legislation Identifier).
 *
 * ELI معيار عالمي لإسناد التشريعات بمعرّف URI دائم ومنظّم. حكيم ليس الجهة
 * المُشرّعة، لذا هذا **معرّف بنمط ELI خاص بالمنصّة** (scope: hakeem) يوفّر
 * رابطًا ثابتًا لكل مادة، مبنيًّا على المفتاح الفريد (اسم النظام + رقم المادة).
 *
 * البنية:  eli/sa/{slug-النظام}/art/{رقم-المادة}
 * مثال:    eli/sa/نظام-المعاملات-المدنية/art/1
 *
 * المعرّف ثابت: لا يتغيّر بتغيّر معرّف قاعدة البيانات الداخلي (cuid)،
 * فهو مشتقّ من القيود الفريدة @@unique([lawName, articleNumber]).
 */

const DIACRITICS = /[ً-ْٰـ]/g; // تشكيل + تطويل

/** تطبيع اسم النظام إلى slug ثابت قابل للعكس بالمطابقة. */
export function lawSlug(name: string): string {
  return name
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "-") // أي فاصل/رمز → شرطة
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export interface ArticleEli {
  /** المعرّف النسبي: eli/sa/{slug}/art/{n} */
  id: string;
  /** المسار القابل للنقر داخل المنصّة */
  path: string;
}

export function buildArticleEli(lawName: string, articleNumber: number): ArticleEli {
  const id = `eli/sa/${lawSlug(lawName)}/art/${articleNumber}`;
  return { id, path: `/${id}` };
}

/** يحلّل مسار ELI إلى (slug النظام، رقم المادة) أو null. */
export function parseArticleEli(segments: string[]): { slug: string; articleNumber: number } | null {
  // المتوقّع: ["sa", "{slug}", "art", "{n}"]
  if (segments.length !== 4) return null;
  const [country, slug, kind, numRaw] = segments;
  if (country !== "sa" || kind !== "art") return null;
  const articleNumber = Number(numRaw);
  if (!Number.isInteger(articleNumber) || articleNumber <= 0) return null;
  return { slug: decodeURIComponent(slug), articleNumber };
}
