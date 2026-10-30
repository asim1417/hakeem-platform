/**
 * عيّنة «العنصر المعروف» (known-item) — مصدر واحد لـ eval-known-item.ts (النواة searchLegalCore) وeval-precise.ts
 * (HKM-062: مسار hakeem_search ‏searchArticles)، فتُقاس الاستعلامات نفسها في المسارين.
 *
 * عنوان المادة في هذا الكوربوس **تسمية رقمية غالباً** («المادة الثالثة»، «المادة (89):») لا عنوانًا وصفيًا — فاستعلام
 * العنصر المعروف من العنوان الخام ملتبس (لكلّ نظام «مادة ثالثة»). لذا نبني الاستعلام من إشارة مميِّزة: (١) الموضوع بعد
 * النقطتين، (٢) الكلمات المفتاحية، وإلا نتجاوز. العيّنة حتمية: مسح مرتّب بالمعرّف ثم كل k-ة، بلا تكرار للاستعلام.
 */
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { prisma } from "@/lib/prisma";

export type LightArticle = { id: string; title: string; lawName: string; articleNumber: number; keywords: string[] };
export type KnownItem = { a: LightArticle; q: string; source: "colon" | "keywords" };

// «تسمية رقمية بحتة» = تبدأ بـ «المادة/مادة» وليس بعد رقمها/ترتيبها نصّ وصفي.
// ملاحظة: \b لا يصلح للعربية في JS (\w لاتيني)، فنكتشف الوصف عبر النقطتين لا حدود الكلمة.
function subjectAfterColon(title: string): string | null {
  const idx = title.search(/[:：]/);
  if (idx < 0) return null;
  const subject = title.slice(idx + 1).trim();
  return subject.length ? subject : null;
}

// يبني استعلام عنصر معروف مميِّزًا من المادة، أو null إن تعذّر (تسمية رقمية بلا موضوع ولا كلمات).
export function buildKnownItemQuery(a: LightArticle, minLen: number): { query: string; source: "colon" | "keywords" } | null {
  const title = (a.title ?? "").trim();
  const subject = title.length ? subjectAfterColon(title) : null;
  if (subject && subject.length >= minLen && !/^[\d\s٠-٩().,-]+$/.test(subject)) {
    return { query: subject, source: "colon" };
  }
  // نُصفّي «كلمات» ملوّثة بميتاداتا الاستيراد (source:hoqoqi_sql / review:needs_review / article:…):
  // أيّ رمز يحوي حروفًا لاتينية أو «:» أو «_» ليس كلمةً مفتاحية عربية مميِّزة، فنُسقطه كي لا
  // يصنع استعلامًا شبه دائري يطابق المادة عبر ميتاداتاها المفهرسة.
  const kw = (a.keywords ?? [])
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length >= 2 && !/[A-Za-z:_]/.test(k));
  if (kw.length) {
    const q = kw.slice(0, 6).join(" ");
    if (q.length >= minLen) return { query: q, source: "keywords" };
  }
  return null;
}

/** المواد التي يُبنى منها استعلام مميِّز (مسح خفيف مرتّب بالمعرّف، حتمي). يرمي إن تعذّر الاتصال. */
export async function loadUsableKnownItems(minTitle: number): Promise<KnownItem[]> {
  const rows = await prisma.legalArticle.findMany({
    orderBy: { id: "asc" },
    select: { id: true, title: true, lawName: true, articleNumber: true, keywords: true },
  });
  return rows
    .map((r: LightArticle) => {
      const built = buildKnownItemQuery(r, minTitle);
      return built ? { a: r, q: built.query, source: built.source } : null;
    })
    .filter((x: KnownItem | null): x is KnownItem => x !== null);
}

/** أخذ حتمي متباعد عبر الكوربوس (لا عشوائية): كل stride-ة، ونزيل تكرار الاستعلام (التباس عبر الأنظمة). */
export function strideSample(usable: KnownItem[], sampleSize: number): { sample: KnownItem[]; stride: number } {
  const stride = Math.max(1, Math.floor(usable.length / sampleSize));
  const seen = new Set<string>();
  const sample: KnownItem[] = [];
  for (let i = 0; i < usable.length && sample.length < sampleSize; i += stride) {
    const item = usable[i];
    const key = normalizeArabicText(item.q);
    if (seen.has(key)) continue; // استعلام مكرّر عبر أنظمة → عنصر معروف ملتبس، نتجاوزه
    seen.add(key);
    sample.push(item);
  }
  return { sample, stride };
}
