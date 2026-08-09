/**
 * hakeem_research — البحث الموضوعي الشامل باستدعاء واحد
 *
 * مبدأ الإصلاح (v2.1): حجة الشمول لفظية، وحجة الاسترجاع دلالية، ولا يُخلَط المساران:
 *   • المسار اللفظي (lexical): مشتقات رأس الموضوع فقط — مصدر total/by_law/exhaustive.
 *   • المسار الدلالي (semantic): الموضوع + صيغ المكنز المنقّحة — مصدره hybridSearch.
 * المطابقة الجزئية على الجذر تُغني عن توليد البوادئ (مصدر التشوّه سابقًا)، ويكفي نمطا
 * حشو الألف والواو لتغطية المصدر واسم المفعول. وفلتر «يحتوي الرأس» يحسم التباس علاقات
 * SKOS: broader للفسخ نافع دائمًا، وnarrower لأنواع العقد ضارّ غالبًا.
 *
 * يعيد استخدام دوال الأدوات القائمة (searchArticles/expandTerms) — لا محرّك جديد.
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
type Hit = SearchHit & { via: string[]; lexical_match: boolean };

/** أدوات وقف عربية شائعة — تُستبعد عند اشتقاق رأس الموضوع. */
const AR_STOP = new Set(["في", "من", "على", "عن", "إلى", "أو", "و", "ثم", "مع", "لدى", "عند"]);

/** رأس الموضوع: أول كلمة دلالية بعد تجريد «ال» (الكلمة المعرّفة غالبًا مضاف إليه عام). */
function headToken(topic: string): string {
  const words = topic.trim().split(/\s+/).filter((w) => !AR_STOP.has(w));
  const first = (words[0] ?? topic).replace(/^ال/, "");
  return first;
}

/**
 * مشتقات لفظية للمطابقة بـ ILIKE '%..%':
 * المطابقة الجزئية تغطي تلقائيًّا كل صيغة تحتوي الجذر متصلًا
 * (فسخ ⊂ يفسخ، تفسخ، الفسخ، انفسخ، ينفسخ، فسخه...)،
 * ويبقى نمطان لكسر الاتصال بحرف علة قبل اللام:
 * ألف المصدر (انفساخ ⊃ فساخ) وواو المفعول (مفسوخ ⊃ فسوخ).
 */
function lexicalVariants(head: string): string[] {
  const h = head.replace(/^ال/, "").trim();
  if (h.length < 3 || h.length > 5 || /\s/.test(h)) return [h];
  const stem = h.slice(0, -1);
  const last = h.slice(-1);
  return [h, `${stem}ا${last}`, `${stem}و${last}`];
}

/** إزالة التكرار بعد التطبيع العربي (يحفظ الصيغة الخام الأولى). */
function dedupeNormalized(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const raw = (t ?? "").trim();
    const k = normalizeAr(raw);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
  }
  return out;
}

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

export async function handleResearch(args: {
  topic: string;
  extra_terms?: string[];
  per_term_limit?: number;
  law_id?: string;
  strict?: boolean;
}) {
  const limit = Math.min(Math.max(args.per_term_limit ?? 8, 3), 20);
  const strict = args.strict ?? true;

  // ① رأس الموضوع ومشتقاته اللفظية (المسار اللفظي وحده)
  const head = headToken(args.topic);
  const lexicalTerms = lexicalVariants(head);
  const lexicalNorm = lexicalTerms.map(normalizeAr).filter(Boolean);
  const snippetHasHead = (snippet?: string): boolean => {
    if (!snippet) return false;
    const n = normalizeAr(snippet);
    return lexicalNorm.some((v) => n.includes(v));
  };

  // ② التوسيع من المكنز، ثم تنقيح صيغ المسار الدلالي بفلتر «يحتوي الرأس»
  const thesaurus = await expandFromThesaurus(args.topic);
  const isRelevant = (t: string) => t.includes(head) || t.replace(/^ال/, "").includes(head);
  const semanticTerms = dedupeNormalized([
    args.topic,
    ...thesaurus.broader, // كان مُهملًا — يُضمّ دائمًا (الأعمّ نافع)
    ...thesaurus.synonyms.filter(isRelevant), // يسقط «العقد» العام
    ...thesaurus.narrower.filter(isRelevant), // يسقط أنواع العقود
    ...thesaurus.related.filter(isRelevant),
    ...(args.extra_terms ?? []), // ما يضيفه المستخدم يمر بلا فلترة
  ]).slice(0, 8);

  // ③ تشغيل متوازٍ: دلالي بصيغ المكنز المنقّحة + حصر لفظي بمشتقات الرأس فقط
  const [hybridBatches, lexical] = await Promise.all([
    Promise.all(semanticTerms.map((t) => hybridSearch(t, limit, args.law_id).catch(() => [] as SearchHit[]))),
    handleEnumerate({ terms: lexicalTerms, law_id: args.law_id, page_size: 50, snippet_len: 500 }),
  ]);

  // ④ الدمج ووسم الصلة اللفظية
  const lexicalIds = new Set(lexical.page.map((r) => r.article_id));
  const merged = new Map<string, Hit>();
  hybridBatches.forEach((batch, i) => {
    for (const r of batch) {
      const prev = merged.get(r.article_id);
      if (prev) {
        if (!prev.via.includes(semanticTerms[i])) prev.via.push(semanticTerms[i]);
      } else {
        merged.set(r.article_id, { ...r, via: [semanticTerms[i]], lexical_match: false });
      }
    }
  });
  for (const r of lexical.page) {
    const prev = merged.get(r.article_id);
    if (prev) {
      if (!prev.via.includes("حصر لفظي")) prev.via.push("حصر لفظي");
    } else {
      merged.set(r.article_id, {
        article_id: r.article_id,
        law: r.law,
        law_id: r.law_id,
        article_number: r.article_number,
        snippet: r.snippet,
        via: ["حصر لفظي"],
        lexical_match: false,
      });
    }
  }
  // مادة من الحصر اللفظي تحتوي الرأس قطعًا (طابقت النصّ كاملًا)؛ ونتائج الدلالي
  // تُوسم بمطابقة المقتطف المُطبَّع.
  for (const r of merged.values()) {
    r.lexical_match = lexicalIds.has(r.article_id) || snippetHasHead(r.snippet);
  }

  const all = [...merged.values()];
  const displayed = strict ? all.filter((r) => r.lexical_match) : all;
  const excludedCount = all.length - displayed.length;

  const byLaw = new Map<string, { law_id: string | null; law: string; articles: Hit[] }>();
  for (const r of displayed) {
    const key = r.law_id ?? `name:${r.law}`;
    if (!byLaw.has(key)) byLaw.set(key, { law_id: r.law_id, law: r.law, articles: [] });
    byLaw.get(key)!.articles.push(r);
  }

  const termsUsed = dedupeNormalized([...lexicalTerms, ...semanticTerms]);

  return {
    topic: args.topic,
    strict,
    terms_used: termsUsed, // اتحاد المسارين (توافق خلفي)
    lexical_terms: lexicalTerms,
    semantic_terms: semanticTerms,
    thesaurus_expansion: thesaurus,
    coverage: {
      laws_matched: byLaw.size,
      articles_matched: displayed.length,
      lexical_total_in_corpus: lexical.total,
      lexical_by_law: lexical.by_law,
      exhaustive: lexical.next_cursor === null,
      semantic_only_excluded: strict ? excludedCount : 0,
    },
    grouped_by_law: [...byLaw.values()].map((g) => ({
      law_id: g.law_id,
      law: g.law,
      count: g.articles.length,
      articles: g.articles
        .slice()
        .sort((a, b) => a.article_number - b.article_number)
        .map((a) => ({
          article_id: a.article_id,
          law: a.law,
          law_id: a.law_id,
          article_number: a.article_number,
          snippet: a.snippet,
          via: a.via,
          lexical_match: a.lexical_match,
        })),
    })),
    note: lexical.next_cursor
      ? "الحصر اللفظي فيه صفحات إضافية — استعمل hakeem_enumerate بمشتقات الرأس مع cursor لاستكماله."
      : "الحصر اللفظي مكتمل؛ التغطية شاملة على مستوى اللفظ.",
  };
}
