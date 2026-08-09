/**
 * hakeem_research — البحث الموضوعي الشامل باستدعاء واحد
 * ① يوسّع المصطلح من المكنز SKOS (عبر hakeem_expand_terms)
 * ② يضيف اشتقاقات لفظية شائعة
 * ③ يشغّل البحث الهجين (hakeem_search) + الحصر اللفظي (hakeem_enumerate) بالتوازي
 * ④ يدمج ويجمّع حسب النظام مع إحصاء تغطية صريح (exhaustive)
 *
 * مُكيَّف: يعيد استخدام دوال الأدوات السبع القائمة (searchArticles/expandTerms)
 * بدل أي محرّك جديد — فتبقى عقود المخرجات والسلوك متّسقة.
 */
import { handleEnumerate, normalizeAr } from "./enumerate";
import { searchArticles, expandTerms } from "@/lib/mcp/adapter";

export const researchToolDef = {
  name: "hakeem_research",
  description:
    "بحث موضوعي شامل باستدعاء واحد: يوسّع المصطلح من المكنز القانوني السعودي ثم يشغّل بحثات متوازية (دلالية + حصر لفظي) بكل النظائر، ويرجع النتائج مجمّعة حسب النظام مع إحصاء تغطية وقائمة الصيغ المستعملة. الأداة المفضلة لإعداد الدراسات والمذكرات.",
};

type Thesaurus = { synonyms: string[]; broader: string[]; narrower: string[]; related: string[] };
type SearchHit = { article_id: string; law: string; law_id: string | null; article_number: number; snippet?: string };
type Hit = SearchHit & { via: string[] };

/** توسيع من المكنز عبر الدالة القائمة خلف hakeem_expand_terms — سقوط آمن إلى فراغ. */
async function expandFromThesaurus(topic: string): Promise<Thesaurus> {
  const empty: Thesaurus = { synonyms: [], broader: [], narrower: [], related: [] };
  try {
    const r = await expandTerms(topic);
    if (!("synonyms" in r)) return empty; // { found: false, ... }
    return {
      synonyms: r.synonyms ?? [],
      broader: r.broader ?? [],
      narrower: r.narrower ?? [],
      related: r.related ?? [],
    };
  } catch {
    return empty;
  }
}

/** بحث هجين عبر الدالة القائمة خلف hakeem_search — يرجع نفس عقد النتيجة. */
async function hybridSearch(query: string, limit: number, lawId?: string): Promise<SearchHit[]> {
  const r = await searchArticles(query, lawId, limit);
  return r.results;
}

/** اشتقاقات لفظية بسيطة تُضاف للجذر (تكييف صرفي خفيف بلا مكتبات؛ شبكة أمان بعد المكنز). */
function morphVariants(term: string): string[] {
  const t = term.trim();
  const out = new Set<string>([t]);
  if (t.length <= 5) {
    out.add(`ان${t}`);
    out.add(`ين${t}`);
    out.add(`ان${t.slice(0, 2)}ا${t.slice(2)}`); // انفساخ التقريبية
    out.add(`ال${t}`);
  }
  return [...out];
}

export async function handleResearch(args: {
  topic: string;
  extra_terms?: string[];
  per_term_limit?: number;
  law_id?: string;
}) {
  const limit = Math.min(Math.max(args.per_term_limit ?? 8, 3), 20);

  // ① التوسيع من المكنز
  const thesaurus = await expandFromThesaurus(args.topic);

  // ② بناء قائمة الصيغ النهائية (إزالة التكرار بعد التطبيع)
  const raw = [
    args.topic,
    ...thesaurus.synonyms,
    ...thesaurus.narrower,
    ...thesaurus.related,
    ...(args.extra_terms ?? []),
  ].flatMap(morphVariants);
  const seen = new Set<string>();
  const terms = raw
    .filter((t) => {
      const k = normalizeAr(t);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);

  // ③ تشغيل متوازٍ: بحث هجين لكل صيغة + حصر لفظي واحد بكل الصيغ
  const [hybridBatches, lexical] = await Promise.all([
    Promise.all(terms.map((t) => hybridSearch(t, limit, args.law_id).catch(() => [] as SearchHit[]))),
    handleEnumerate({ terms, law_id: args.law_id, page_size: 50, snippet_len: 500 }),
  ]);

  // ④ الدمج وإزالة التكرار حسب معرّف المادة
  const merged = new Map<string, Hit>();
  hybridBatches.forEach((batch, i) => {
    for (const r of batch) {
      const prev = merged.get(r.article_id);
      if (prev) {
        if (!prev.via.includes(terms[i])) prev.via.push(terms[i]);
      } else {
        merged.set(r.article_id, { ...r, via: [terms[i]] });
      }
    }
  });
  for (const r of lexical.page) {
    if (!merged.has(r.article_id)) {
      merged.set(r.article_id, {
        article_id: r.article_id,
        law: r.law,
        law_id: r.law_id,
        article_number: r.article_number,
        snippet: r.snippet,
        via: ["حصر لفظي"],
      });
    }
  }

  const results = [...merged.values()];
  const byLaw = new Map<string, { law_id: string | null; law: string; articles: Hit[] }>();
  for (const r of results) {
    const key = r.law_id ?? `name:${r.law}`;
    if (!byLaw.has(key)) byLaw.set(key, { law_id: r.law_id, law: r.law, articles: [] });
    byLaw.get(key)!.articles.push(r);
  }

  return {
    topic: args.topic,
    terms_used: terms,
    thesaurus_expansion: thesaurus,
    coverage: {
      laws_matched: byLaw.size,
      articles_matched: results.length,
      lexical_total_in_corpus: lexical.total,
      lexical_by_law: lexical.by_law,
      exhaustive: lexical.next_cursor === null,
    },
    grouped_by_law: [...byLaw.values()].map((g) => ({
      law_id: g.law_id,
      law: g.law,
      count: g.articles.length,
      articles: g.articles.sort((a, b) => a.article_number - b.article_number),
    })),
    note: lexical.next_cursor
      ? "الحصر اللفظي فيه صفحات إضافية — استعمل hakeem_enumerate بنفس الصيغ مع cursor لاستكماله."
      : "الحصر اللفظي مكتمل؛ التغطية شاملة على مستوى اللفظ.",
  };
}
