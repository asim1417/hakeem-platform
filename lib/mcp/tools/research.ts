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
 *
 * HKM-044: المسار اللفظي بحدود الكلمة في وضع derivatives (word-match.ts): كانت «غبون» المولَّدة تطابق «يرغبون»
 * فدخلت أربع مواد لا صلة لها في بحث «الغبن» مع ملاحظة «التغطية شاملة». الآن الصيغة كلمة كاملة بسوابقها وحروف
 * اشتقاقها ولواحقها، ووسم المقتطف الدلالي بالنمط نفسه، والملاحظة تقول ما فُتّش وبأي صيغ، ولا تدّعي شمولًا دلاليًا.
 */
import { handleEnumerate, normalizeAr, scopePhrase } from "./enumerate";
import { compileTerm, matchesText, matchModeLabel, type CompiledTerm } from "./word-match";
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
 * صيغ رأس الموضوع للحصر اللفظي (وضع derivatives بحدود الكلمة):
 * الرأس نفسه بسوابقه وحروف مضارعته واشتقاقه ولواحقه (فسخ، يفسخ، الفسخ، انفسخ، ينفسخ، فسخه...)،
 * ونمطان لكسر الاتصال بحرف علة قبل اللام: ألف المصدر (انفساخ ← فساخ) وواو المفعول (مفسوخ ← فسوخ).
 * الصيغة كلمة كاملة لا جزء كلمة: «غبون» تطابق «مغبون» ولا تطابق «يرغبون».
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
  const { head, terms: lexicalTerms, compiled: lexicalCompiled } = researchLexical(args.topic);
  const snippetHasHead = (snippet?: string): boolean => Boolean(snippet) && lexicalCompiled.some((c) => matchesText(snippet as string, c));

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
    handleEnumerate({ terms: lexicalTerms, law_id: args.law_id, page_size: 50, snippet_len: 500, match: "derivatives" }),
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
      lexical_match: matchModeLabel("derivatives"),
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
    note: researchNote({
      head,
      forms: lexicalTerms,
      lexicalTotal: lexical.total,
      shown: lexical.page.length,
      more: lexical.next_cursor !== null,
      lawId: args.law_id,
      rejected: lexicalCompiled.length === 0,
    }),
  };
}

/** المسار اللفظي للبحث الموضوعي: رأس الموضوع وصيغه مجمّعة بوضع derivatives (يُصدَّر للاختبار). */
export function researchLexical(topic: string): { head: string; terms: string[]; compiled: CompiledTerm[] } {
  const head = headToken(topic);
  const terms = lexicalVariants(head);
  const compiled = terms.map((t) => compileTerm(t, "derivatives")).filter((c): c is CompiledTerm => c !== null);
  return { head, terms, compiled };
}

/** ملاحظة البحث الموضوعي: ما فُتّش وبأي صيغ، ونوع الشمول (لفظي لا دلالي)، وما بقي — أو أن الرأس رُفض فلم يُفتَّش شيء. */
export function researchNote(o: {
  head: string;
  forms: string[];
  lexicalTotal: number;
  shown: number;
  more: boolean;
  lawId?: string | null;
  rejected?: boolean;
}): string {
  if (o.rejected)
    return `رُفض رأس الموضوع «${o.head}»: لا حرف فيه ولا رقم، فلم يُفتَّش لفظيًّا شيء. هذا ليس نفيًا؛ أعد الصياغة بلفظ المسألة.`;
  const sc = scopePhrase(o.lawId);
  const forms = `«${o.head}» بصيغه (${o.forms.join("، ")}) كلماتٍ كاملة`;
  if (o.lexicalTotal === 0)
    return `فُتّش ${sc.whole} فلم يرد ${forms} في أي مادة. هذا نفي لفظي في هذا النطاق وحده؛ المسألة قد ترد بلفظ آخر — انظر نتائج المسار الدلالي (strict=false) أو hakeem_search.`;
  if (o.more)
    return `العدد اللفظي lexical_total_in_corpus (${o.lexicalTotal}) كامل في ${sc.whole}، والمعروض أول ${o.shown} منه — أكمل بـ hakeem_enumerate(match="derivatives") بالصيغ نفسها مع cursor. الشمول لفظي لا دلالي: ما عبّر عن المسألة بلفظ آخر لا يدخل في هذا العدد.`;
  return `الحصر اللفظي ${forms} مكتمل في ${sc.whole} (${o.lexicalTotal} مادة). الشمول لفظي لا دلالي: ما عبّر عن المسألة بلفظ آخر لا يدخل في هذا العدد.`;
}
