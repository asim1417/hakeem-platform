/**
 * حكيم MCP — طبقة الوصول للبيانات (Adapter)
 *
 * تربط أدوات خادم MCP بمخطط قاعدة بيانات حكيم الفعلي (prisma/schema.prisma)
 * وبمحرّك البحث الهجين القائم في المشروع (postgres + vector + knowledge graph)
 * بدل استعلامات `contains` المبسّطة. لا تُغيّر أسماء حقول المخرجات (JSON) —
 * فهي العقد الرسمي لخادم MCP.
 *
 * مطابقة النماذج (تقديري → فعلي):
 *   article        → LegalArticle   (prisma.legalArticle)
 *   law            → LegalSystem    (prisma.legalSystem)
 *   ruling         → JudicialCase   (prisma.judicialCase)
 *   thesaurusTerm  → legal_thesaurus_* (جداول SQL، تُقرأ عبر وحدة legal-thesaurus)
 *   lawRelation    → LegalRelation  (prisma.legalRelation، علاقات polymorphic)
 */
import { prisma } from "@/lib/prisma";
import { resolveLaw, isNumberingShifted } from "@/lib/modules/legal-core/resolve-law";
import { redactPII, searchRulingsDirect, splitRulingQuery } from "@/lib/modules/legal-core/rulings-search";
import { citationFlagsFromVerification } from "@/lib/modules/legal-core/verified-status";
import { latestVerification } from "@/lib/modules/legal-core/verification-read";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";
import { effectiveArticleTexts } from "@/lib/modules/legal-core/effective-text";
import { BUDGET_EXCEEDED, filterArticleIdsToSurface, hybridSearch, providerBudgetMs, withBudget } from "@/lib/modules/legal-search/hybrid-search";
import { acceptFill, bm25TermWeight, keepCandidate, lexicalPageUsable, rankFused, RARE_TERM_MAX, type FusionCandidate } from "@/lib/mcp/search-fusion";
import { handleSemanticSearch, hintedLaws, queryKeywords } from "@/lib/mcp/tools/semantic";
import { handleEnumerate } from "@/lib/mcp/tools/enumerate";
import { loadLawCatalog } from "@/lib/mcp/tools/catalog";
import { compileTerm, matchesNormalized, matchPositions, normalizeAr, windowCoverage, type CompiledTerm } from "@/lib/mcp/tools/word-match";
import { matchThesaurusConcepts } from "@/lib/modules/legal-thesaurus/concept-index";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { getLawTool } from "@/lib/mcp/tools/get-law";
import { articleRef } from "@/lib/mcp/tools/citation";
import { articleIssuance, loadLawCardIssuance } from "@/lib/mcp/tools/article-issuance";
import type { SqlClient } from "@/lib/modules/legal-core/sql-port";
import { queryTokens } from "@/lib/modules/legal-core/ruling-excerpts";
import {
  checkedLexicalGroups,
  enumeratePhrase,
  lexicalVisible,
  maskedMatchWords,
  maskedRulingExcerpts,
  rawMatchWords,
  semanticNameHit,
} from "@/lib/mcp/ruling-privacy";
import { lexicalQueryTainted } from "@/lib/mcp/name-taint";
import { loadStoredSegments } from "@/lib/rulings/research/stored-segments";

/** مقتطف نصّي بطول ثابت (عقد المخرجات). */
const SNIPPET = 400;
function snippet(text?: string | null): string | undefined {
  return text ? redactPII(text.slice(0, SNIPPET)) : undefined;
}

/** تطبيع رقم المادة القادم كنصّ إلى عدد صحيح (المخطط يخزّنه Int). */
function toArticleNumber(raw: string): number | null {
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * HKM-030: يحلّل إحالة المادة كما تصل نصًّا: «12»، «12 مكرر»، «12 مكرر 2»، «١٢ مكرر»، «المادة 12 مكررًا».
 * يعيد الرقم ودرجة «مكرر» (0 للأصل، 1 لـ«مكرر» بلا رقم). الأرقام العربية-الهندية تُوحَّد.
 */
export function parseArticleCitation(raw: string): { n: number; bis: number } | null {
  const ascii = String(raw ?? "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  // «مكرر» وصِيَغه («مكررًا»، «مكررة»): اللاحقة حروف عربية/تشكيل متّصلة بالكلمة فقط.
  const m = ascii.match(/(\d+)\s*(?:\(?\s*(مكرر[ء-يً-ْ]*)\s*(\d+)?\s*\)?)?/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return null;
  const bis = m[2] ? (m[3] ? Number.parseInt(m[3], 10) : 1) : 0;
  return { n, bis: Number.isFinite(bis) ? bis : 1 };
}


/** HKM-048: معرّفات المواد مرتّبة بدمج الحصر اللفظي للألفاظ النادرة والبحث الدلالي. */
async function fusedArticleIds(query: string, lawId: string | undefined, limit: number, lexicalProbe: boolean): Promise<Array<{ id: string; type: string }>> {
  const db = prismaSqlClient(prisma);
  const keywords = queryKeywords(query);
  const compiled = keywords.map((k) => compileTerm(k, "derivatives")).filter((c): c is CompiledTerm => c !== null);
  if (!compiled.length) return [];
  const coverageOf = (text: string) => {
    const norm = normalizeAr(text);
    return compiled.filter((c) => matchesNormalized(norm, c)).length / compiled.length;
  };
  // الألفاظ الأطول أندر غالبًا؛ حصران كحدٍّ أقصى لضبط الكلفة (كل حصر مسح كامل للمدونة).
  const probe = lexicalProbe ? [...keywords].sort((a, b) => b.length - a.length).slice(0, 2) : [];
  // ميزانية زمنية لكل مصدر: البطيء يُسقَط وتبقى نتائج الآخر (كما في المحرك الهجين).
  const budget = providerBudgetMs();
  const bounded = async <T>(work: Promise<T>, fallback: T): Promise<T> => {
    const r = await withBudget(work.catch(() => fallback), budget);
    return r === BUDGET_EXCEEDED ? fallback : (r as T);
  };
  const [semantic, lexicalPages, catalog] = await Promise.all([
    // HKM-053: الحصر بالنظام داخل استعلام المتجهات (كان يُجلب أقرب 20 من المدونة ثم يُصفّى فيخلو).
    bounded(handleSemanticSearch(db, { query, limit: 20, ...(lawId ? { law_id: lawId } : {}) }) as Promise<Awaited<ReturnType<typeof handleSemanticSearch>> | null>, null),
    Promise.all(probe.map((t) => bounded(handleEnumerate({ terms: [t], law_id: lawId, page_size: RARE_TERM_MAX, snippet_len: 2000 }), null))),
    bounded(loadLawCatalog(db), []),
  ]);
  const named = hintedLaws(query, catalog);
  const cands: FusionCandidate[] = [];
  const semResults = semantic && "results" in semantic ? (semantic.results as Array<{ article_id: string; law_id: string | null; similarity: number; keyword_coverage: number }>) : [];
  for (const r of semResults) {
    if (lawId && r.law_id !== lawId) continue; // صمام أمان: الاستعلام محصور أصلًا
    cands.push({ id: r.article_id, coverage: r.keyword_coverage, similarity: r.similarity, lexicalHit: false, lawNamed: Boolean(r.law_id && named.has(r.law_id)) });
  }
  const lexRows = lexicalPages.flatMap((page) => (!page || !lexicalPageUsable(page.total, Boolean(lawId)) ? [] : page.page.filter((r) => !r.repealed)));
  // HKM-051: القرب بين الألفاظ يُقاس على النص الكامل لا المقتطف المقصوص.
  const fullText = new Map<string, string>();
  if (lexRows.length) {
    const rows = await prisma.legalArticle.findMany({ where: { id: { in: [...new Set(lexRows.map((r) => r.article_id))] } }, select: { id: true, content: true } }).catch(() => []);
    for (const r of rows) fullText.set(r.id, r.content ?? "");
  }
  // HKM-058: وزن التكرار (BM25) لكسر التعادل بين مرشحين بالتغطية نفسها؛ متوسط الطول من المرشحين اللفظيين.
  const lexNorm = lexRows.map((r) => normalizeAr(fullText.get(r.article_id) ?? r.snippet));
  const avgLen = lexNorm.length ? lexNorm.reduce((n, t) => n + t.length, 0) / lexNorm.length : 0;
  lexRows.forEach((r, i) => {
    const norm = lexNorm[i];
    const tf = compiled.reduce((n, c) => n + matchPositions(norm, c).length, 0);
    // لفظ شائع (نتائجه أكثر من الحد) استُبعدت صفحته أعلاه: لا يميّز مادة.
    cands.push({
      id: r.article_id,
      coverage: windowCoverage(norm, compiled),
      similarity: 0,
      lexicalHit: true,
      lawNamed: Boolean(r.law_id && named.has(r.law_id)),
      termWeight: bm25TermWeight(tf, norm.length, avgLen),
    });
  });
  // مرشح الوجه: لا تُعرض مواد أنظمة ملغاة أو مخفية عن الوجه الحالي (كالمحرك الهجين).
  const allowed = await filterArticleIdsToSurface([...new Set(cands.map((c) => c.id))]).catch(() => null);
  const visible = (allowed ? cands.filter((c) => allowed.has(c.id)) : cands).filter((c) => keepCandidate(c, compiled.length));
  return rankFused(visible, limit).map((c) => ({ id: c.id, type: "article" }));
}

// ١) البحث في المواد — HKM-048: دمج دليلين مستقلين (اللفظ النادر + المعنى) بترتيب تغطية الألفاظ،
// وعند خلوّهما يرجع إلى المحرّك الهجين القديم (لا تتراجع القدرة).
export async function searchArticles(query: string, lawId?: string, limit = 10, opts: { lexicalProbe?: boolean } = {}) {
  // HKM-053: الحصر بالنظام شرط داخل المصادر الثلاثة (الدلالي واللفظي والهجين) قبل الترتيب، والتصفية بعدها صمام أمان.
  const fetchLimit = limit;
  let ranked: Array<{ id: string; type: string }> = await fusedArticleIds(query, lawId, fetchLimit, opts.lexicalProbe ?? true).catch(() => []);
  const fusedIds = new Set(ranked.map((r) => r.id));
  if (ranked.length < fetchLimit) {
    // تكملة من المحرك الهجين حتى الحد (لا يقل الاسترجاع عن السابق)، بلا تكرار.
    // المواد وحدها: الأحكام لا تأخذ مقاعد في الدمج ثم تُحذف (كانت تكشف بعدد المواد المعادة وجود اسم فرد في الأحكام).
    const res = await hybridSearch({ q: query, limit: fetchLimit, types: ["article"], ...(lawId ? { lawIds: [lawId] } : {}) }).catch(() => null);
    const have = new Set(ranked.map((r) => r.id));
    ranked = [...ranked, ...(res?.results ?? []).filter((r) => r.type === "article" && !have.has(r.id))].slice(0, fetchLimit);
  }

  // ترطيب من القاعدة لضمان حقول العقد الدقيقة (خاصّة law_id = معرّف النظام).
  const fillTerms = queryKeywords(query).map((k) => compileTerm(k, "derivatives")).filter((c): c is CompiledTerm => c !== null);
  const fillCoverage = (text: string) => {
    return fillTerms.length ? windowCoverage(normalizeAr(text), fillTerms) : 0;
  };
  const ids = ranked.map((r) => r.id);
  const rows = ids.length
    ? await prisma.legalArticle.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          legalSystemId: true,
          lawName: true,
          articleNumber: true,
          articleBis: true,
          content: true,
          legalSystem: { select: { id: true, name: true } },
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const inScope = ranked
    .map((r) => byId.get(r.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter((r) => (lawId ? r.legalSystemId === lawId || r.legalSystem?.id === lawId : true)); // صمام أمان
  // HKM-049: مادة التكملة الهجينة لا تدخل إلا إن غطّت نصف ألفاظ السؤال في نصها (يقطع الضجيج: م5 لائحة التدريب).
  const relevant = inScope.filter((r) => fusedIds.has(r.id) || acceptFill(fillCoverage(r.content ?? ""), fillTerms.length));
  // لا تراجع في الاسترجاع: إن لم يبقَ شيء (الدمج خلا وكل التكملة دون الحد) تُعاد التكملة كما كانت.
  const picked = (relevant.length ? relevant : inScope).slice(0, limit);
  // المقتطف من النص الساري (المصدر الواحد)، والملغاة تُرجع سطر الإلغاء.
  const effective = await effectiveArticleTexts(picked);
  const results = picked.map((r) => {
    const e = effective.get(r.id);
    return {
      article_id: r.id,
      law: r.legalSystem?.name ?? r.lawName,
      law_id: r.legalSystem?.id ?? r.legalSystemId,
      article_number: r.articleNumber,
      article_bis: r.articleBis ?? 0, // درجة «مكرر» (0 للأصل) — HKM-030
      snippet: snippet(e?.text ?? r.content),
      repealed: e?.repealed ?? false,
    };
  });

  return { query, count: results.length, results };
}

// ٢) نص المادة كاملًا
export async function getArticle(articleId: string) {
  const a = await prisma.legalArticle.findUnique({
    where: { id: articleId },
    include: { legalSystem: { select: { id: true, name: true } } },
  });
  if (!a) return { error: "المادة غير موجودة" };
  const [effective, card] = await Promise.all([
    effectiveArticleTexts([{ id: a.id, content: a.content }]),
    // HKM-053: أداة الإصدار من بطاقة النظام عند غياب عمود المادة (كان issued_by فارغًا للإفلاس والإثبات).
    !a.royalDecree?.trim() && a.legalSystemId ? loadLawCardIssuance(prismaSqlClient(prisma), a.legalSystemId).catch(() => null) : Promise.resolve(null),
  ]);
  const e = effective.get(a.id);
  const issuance = articleIssuance(a.royalDecree, card);
  return {
    article_id: a.id,
    law: a.legalSystem?.name ?? a.lawName,
    law_id: a.legalSystem?.id ?? a.legalSystemId,
    issued_by: issuance.issuedBy, // أداة المادة إن وُجدت، وإلا أداة إصدار النظام من بطاقته
    issued_date_h: issuance.issuedDateH, // تاريخ إصدار النظام من بطاقته (null مع أداة على مستوى المادة)
    article_number: a.articleNumber,
    article_bis: a.articleBis ?? 0, // درجة «مكرر» (0 للأصل) — HKM-030
    // status بقيمه المعهودة (سارية/معدّلة/ملغاة)؛ verified_status = حالة سجل التحقق.
    status: e?.repealed ? "ملغاة" : e?.source === "unit_version" ? "معدّلة" : a.status ?? null,
    verified_status: e?.status ?? null,
    repealed: e?.repealed ?? false,
    // النص الساري اليوم (unit_version)، أو سطر الإلغاء لمادة ملغاة.
    text: e?.text ?? a.content,
    text_basis: e?.basis ?? null,
    valid_from: e?.validFrom ? e.validFrom.slice(0, 10) : null,
    evidence_instrument: e?.evidenceInstrument ?? null,
    evidence_url: e?.evidenceUrl ?? null,
  };
}

// ٣) بطاقة النظام وفهرسه (HKM-023-B ع-١٣): المطابقة تامة ← يبدأ بـ ← احتواء، والبطاقة والمقدمة وحالة كل مادة
// من getLawPageData. العقد إضافي: الحقول القديمة باقية بأسمائها (lib/mcp/tools/get-law.ts).
// HKM-044: الفهرس صفحات (toc_offset/toc_limit) ونص المقدمة بطلب صريح (include_preamble).
export async function getLaw(lawId?: string, name?: string, view: { tocOffset?: number; tocLimit?: number; includePreamble?: boolean } = {}) {
  return getLawTool(prismaSqlClient(prisma), { lawId, name }, { siteUrl: getSiteUrl(), ...view });
}

// ٤) روابط النظام واللوائح (IMPLEMENTS) — LegalRelation متعدّد الأشكال (type+id).
export async function getBylawLinks(lawId: string) {
  const rels = await prisma.legalRelation.findMany({
    where: {
      relation: "IMPLEMENTS",
      OR: [{ sourceId: lawId }, { targetId: lawId }],
    },
    select: { sourceId: true, targetId: true },
  });

  // اللائحة (source) «تنفّذ» النظام الأمّ (target)؛ فمن منظور lawId:
  //   implements      = ما يُشير إليه هذا المعرّف بوصفه مصدرًا (ينفّذ نظامًا أعلى)
  //   implemented_by  = ما يُشير إلى هذا المعرّف بوصفه هدفًا (لوائحه التنفيذية)
  const implementsIds = rels.filter((r) => r.sourceId === lawId).map((r) => r.targetId);
  const implementedByIds = rels.filter((r) => r.targetId === lawId).map((r) => r.sourceId);

  const allIds = Array.from(new Set([...implementsIds, ...implementedByIds]));
  const systems = allIds.length
    ? await prisma.legalSystem.findMany({ where: { id: { in: allIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(systems.map((s) => [s.id, s.name]));
  const toRefs = (ids: string[]) =>
    ids.map((id) => ({ id, name: nameById.get(id) ?? null })).filter((x) => x.name !== null);

  return {
    law_id: lawId,
    implements: toRefs(implementsIds),
    implemented_by: toRefs(implementedByIds),
  };
}

// ٥) توسيع المصطلح من مكنز SKOS (legal_thesaurus_*) — عبر وحدة المكنز القائمة.
export async function expandTerms(term: string) {
  const match = await matchThesaurusConcepts(term).catch(() => null);
  if (!match || !match.matched.length) {
    return { term, found: false, hint: "استخدم المصطلح كما هو في البحث" };
  }

  // معرّفات المفاهيم UUID من قاعدتنا — نتحقّق من الصيغة قبل الإدراج (لا حقن).
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const ids = match.conceptIds.filter((id) => UUID_RE.test(id));
  const idList = ids.map((id) => `'${id}'`).join(",");

  let broader: string[] = [];
  let narrower: string[] = [];
  let related: string[] = [];
  if (idList) {
    const rows = await prisma.$queryRawUnsafe<Array<{ relation_type: string; label: string }>>(
      `SELECT r.relation_type AS relation_type, tc.preferred_label_ar AS label
         FROM legal_thesaurus_relations r
         JOIN legal_thesaurus_concepts tc ON tc.id = r.target_concept_id
        WHERE r.source_concept_id IN (${idList})
        LIMIT 200`
    ).catch(() => [] as Array<{ relation_type: string; label: string }>);
    const pick = (t: string) =>
      Array.from(new Set(rows.filter((x) => x.relation_type === t).map((x) => (x.label || "").trim()).filter(Boolean)));
    broader = pick("broader");
    narrower = pick("narrower");
    related = pick("related");
  }

  return {
    term,
    pref_label: match.matched[0]?.label ?? term,
    synonyms: match.synonyms,
    broader,
    narrower,
    related,
  };
}

/** دفعة مرشحي بحث الأحكام (وتُجلب دفعتان على الأكثر لإكمال الصفحة). */
const SEARCH_BATCH = 50;
/** طُعم البحث للفظ الاسم: كلمة لا ترد في نص (وصنو لاتيني للفظ الحساس فيبقى في مساره). */
const DECOY_PLAIN = "ققققققققققققق";
const DECOY_SENSITIVE = "qqqqqqqqqqqqqq";
const SHORT_PAGE_NOTE =
  "النتائج من أول 100 مرشح بالترتيب، وما لا يطابقه الاستعلام إلا داخل اسم فرد لا يُعاد؛ فإن قلّت النتائج فضيّق الاستعلام (محكمة أو سنة أو لفظ أخص) أو استعمل hakeem_enumerate_rulings.";

// ٦) البحث في الأحكام — مسار مستقلّ في judicial_cases (searchRulingsDirect)، لا الهجين المشترك.
// كان الهجين يضع الأحكام في منافسة مع المواد والمبادئ على ٣٠ خانة، والحكم غير المُراجَع يأخذ
// درجة أدنى من أي مادة، فتخرج الأحكام كليًّا لألفاظ شائعة مثل «فسخ» و«عقد».
// والمقتطف صار من موضع المطابقة في الأسباب أو المنطوق، لا أول ٤٠٠ حرف (الديباجة).
export async function searchRulings(query: string, court?: string, yearH?: number, limit = 10) {
  type Hit = {
    ruling_id: string;
    case_number: string | null;
    court: string | null;
    year_h: number | null;
    snippet: string;
    matched_in: string | null;
    matched_by: string;
    disposition: string | null;
    parts: Array<{ type: string; start: number; end: number }>;
  };
  // NFKC: الأشكال المعروضة و«ﷲ» في الاستعلام حروف عادية، فتُفحص كما تُفحص النسخة المحجوبة (maskPersonalData يطبّعها).
  const q = (query ?? "").normalize("NFKC");
  const pageCap = Math.min(Math.max(limit, 1), 50);
  // HKM-012: لا يُعثر على حكم باسم فرد. الاستعلام الذي تطابق ألفاظه (بـ AND) داخل الأسماء غالبًا، ولا تظهر عبارته
  // المتجاورة خارجها، لا يطابق شيئًا (كلفظ غائب عن القاعدة). تعذّر الفحص يُعدّ اسمًا (السقوط مغلقًا). ويبقى زمن
  // النداء تابعًا لعدد المطابقات الظاهرة وطولها (كأي لفظ)، لا لكون اللفظ اسمًا.
  const parts = splitRulingQuery(q);
  const text = parts.text;
  const groups = checkedLexicalGroups(text);
  // نافذة مرشحين ثابتة (دفعتان من SEARCH_BATCH) لا تتبع limit، فلا يكشف الفرق بين limit=1 وlimit=20 عدد ما أُسقط.
  const batch = SEARCH_BATCH;
  // الفحص أولًا: لفظ الاسم يُبحث عنه بطُعم لا يطابق شيئًا (بعدد ألفاظه وصنفها وأرقامه ومرشحاته)، فلا يعالج البحث
  // نصوص أحكام الاسم ثم يرميها (كان زمنها يكشف وجوده)؛ فمخرج لفظ الاسم وزمنه كلفظ غائب.
  // وبلا المسار الدلالي في الموصل: متجهات الأحكام مبنية من النص الخام وفيه الأسماء، فلفظ الاسم يجلب أحكامه إلى مجمع
  // المرشحين ثم تُسقط، فينقص المخرج عن مخرج اللفظ الغائب بعددها. يعود بعد بناء المتجهات من النص المحجوب.
  const tainted = await lexicalQueryTainted(groups, enumeratePhrase(text)).catch(() => true);
  const sensitive = new Set(parts.sensitiveTokens);
  const decoy = [...queryTokens(text).map((t) => (sensitive.has(t) ? DECOY_SENSITIVE : DECOY_PLAIN)), ...parts.numbers].join(" ");
  const lexQuery = tainted ? decoy : q;
  const first = await searchRulingsDirect({ query: lexQuery, semantic: false, court, yearH, limit: batch }).catch(() => null);

  // HKM-012 (الأمر ٠٨، المسار ٣): المقتطف والمنطوق من النص المحجوب كاملًا (أسماء الأفراد والأرقام)،
  // لا من مقتطف خام محجوب بعد قصّه. الإزاحات في parts في النص المحجوب كما في hakeem_get_ruling.
  // وكل نتيجة تُعاد حساب مطابقتها على النسخة المحجوبة بباني الإنتاج (ومعها المتن المحجوب كاملًا لمسار الأجزاء):
  // اللفظية تُعاد إن طابقت كل ألفاظها خارج الأسماء، والدلالية تُسقط إن ورد لفظ منها في الحكم داخل اسم.
  // وما تعذّر جلب نصه لا يُعاد.
  const results: Hit[] = [];
  let withheld = 0;
  let r = first;
  for (let round = 0; r && round < 2 && results.length < pageCap; round++) {
    const hits = r.hits;
    const rows = hits.length
      ? await prisma.judicialCase
          .findMany({
            where: { id: { in: hits.map((h) => h.id) } },
            select: { id: true, court: true, judgmentTitle: true, judgmentText: true, appealText: true, caseNo: true, decisionNo: true, cityName: true },
          })
          .catch(() => null)
      : [];
    const byId = new Map((rows ?? []).map((x) => [x.id, x] as const));
    // الأجزاء المخزّنة (ومنها حدود النموذج) متى طابقت بصمة النص، وإلا يقطّع المقتطف بالقواعد.
    const storedSegs = await loadStoredSegments(new Map((rows ?? []).map((x) => [x.id, x.judgmentText ?? ""] as const)));
    for (const h of hits) {
      if (results.length >= pageCap) break;
      if (results.some((x) => x.ruling_id === h.id)) continue;
      const raw = byId.get(h.id);
      if (raw === undefined) {
        withheld++;
        continue;
      }
      // استعلام بلا ألفاظ (أرقام فقط): اللفظي مطابقة رقم لا يمسّها الحجب، والدلالي لا يُفحص فلا يُعاد.
      if (!groups.length && h.matchedBy === "semantic") {
        withheld++;
        continue;
      }
      if (groups.length) {
        const masked = maskedMatchWords(raw);
        const nameOnly = h.matchedBy === "semantic" ? semanticNameHit(rawMatchWords(raw), masked, groups) : !lexicalVisible(masked, groups);
        if (nameOnly) {
          withheld++;
          continue;
        }
      }
      const ex = maskedRulingExcerpts(raw.judgmentText ?? "", q, h.matchedBy === "semantic" ? { part: h.matchedIn, originalSnippet: h.snippet } : null, storedSegs.get(h.id));
      results.push({
        ruling_id: h.id,
        case_number: h.decisionNo ?? h.caseNo ?? null,
        court: h.court ?? null,
        year_h: h.hijriYear ?? null,
        snippet: ex.snippet,
        matched_in: h.matchedIn, // reasons | disposition | defense | claims | header …
        matched_by: h.matchedBy ?? "lexical", // lexical | semantic (متجه الأسباب/المنطوق) | both
        disposition: ex.disposition, // بداية المنطوق
        parts: ex.parts, // لجلب جزء بعينه عبر hakeem_get_ruling (الإزاحات في النص المحجوب)
      });
    }
    // الصفحة لم تمتلئ والدفعة كانت كاملة: دفعة ثانية (لفظية) بعدها.
    if (results.length >= pageCap || hits.length < batch) break;
    r = await searchRulingsDirect({ query: lexQuery, semantic: false, court, yearH, limit: batch, offset: batch }).catch(() => null);
  }
  // عدد القاعدة يشمل أحكامًا لا تطابق إلا داخل اسم، فلا يُعاد لاستعلام فيه لفظ: الإجمالي عدد ما أُعيد،
  // وtotal_is_lower_bound امتلاء الصفحة وحده (لا امتلاء نافذة المرشحين: كان يميّز الخلية التي تكثر فيها المطابقات
  // داخل الأسماء). ولاستعلام الأرقام وحدها (رقم القضية أو القرار) عدد القاعدة كما كان (مسقوف بـ٥٠٠٠).
  if (groups.length || withheld > 0) {
    const out = { query, count: results.length, total: results.length, total_is_lower_bound: results.length >= pageCap, results };
    // تنبيه ثابت متى نقصت الصفحة (لا يتبع ما أُسقط).
    return results.length < pageCap ? { ...out, note: SHORT_PAGE_NOTE } : out;
  }
  return { query, count: results.length, total: first?.total ?? 0, total_is_lower_bound: first?.totalCapped ?? false, results };
}

// ٧) حارس الإحالات — التحقق قبل العزو (يمنع اختلاق المواد).
/**
 * HKM-033: صف تاريخي لمادة ملغاة أو منقولة بأداة لاحقة: الرقم بلا صف قائم (articleBis < 100)، ونصه القديم
 * محفوظ بدرجة ≥ 100 وعليه آخر تحقق «ملغاة»/«ملغى» بسنده. يُعيد الأداة والنص للتمييز عن «غير موجودة».
 */
async function repealedHistoryRow(systemId: string | null, lawName: string, n: number): Promise<{ instrument: string | null; content: string } | null> {
  const rows = await prisma.legalArticle
    .findMany({
      where: { ...(systemId ? { OR: [{ legalSystemId: systemId }, { lawName }] } : { lawName }), articleNumber: n, articleBis: { gte: NON_ARTICLE_BIS } },
      select: { id: true, content: true },
      take: 5,
    })
    .catch(() => []);
  for (const row of rows) {
    const v = await latestVerification("unit", row.id).catch(() => null);
    if (v && citationFlagsFromVerification(v).repealed) return { instrument: v.evidenceInstrument ?? null, content: row.content };
  }
  return null;
}

export async function verifyCitation(lawName: string, articleNumber: string, claimedText?: string, articleBis?: number) {
  // HKM-030: «12 مكرر» يُحلَّل من النص (أو تصل درجة «مكرر» صراحةً) فتُطابَق الصف المكرر لا الأصل.
  const parsed = parseArticleCitation(articleNumber);
  const n = parsed?.n ?? toArticleNumber(articleNumber);
  if (n === null) return { verdict: "رقم المادة غير صالح", law_name: lawName, article_number: articleNumber };
  const bis = Number.isFinite(articleBis) && (articleBis as number) >= 0 ? Math.trunc(articleBis as number) : parsed?.bis ?? 0;

  // حلّ اسم النظام بثبات (1.1): مطابقة تامّة/بادئة وحيدة فقط تُعدّ حاسمة (الاحتواء ليس حاسمًا).
  const resolved = await resolveLaw(lawName);
  if (!resolved.decisive || !resolved.system) {
    return { verdict: "النظام غير محسوم بهذا الاسم", law_name: lawName, candidates: resolved.candidates };
  }
  if (isNumberingShifted(resolved.system.name)) {
    return { verdict: "ترقيم النظام قيد التصحيح الرسميّ — لا يُعتدّ برقم المادة", law: resolved.system.name, article_number: articleNumber };
  }
  const system = resolved.system;

  // نبحث المادة عبر معرّف النظام إن وُجد، وإلا عبر اسم النظام على المادة مباشرة.
  const article = await prisma.legalArticle.findFirst({
    where: system
      ? { OR: [{ legalSystemId: system.id }, { lawName: system.name }], articleNumber: n, articleBis: bis }
      : { lawName: { contains: lawName, mode: "insensitive" }, articleNumber: n, articleBis: bis },
    select: { id: true, articleNumber: true, articleBis: true, content: true, lawName: true, legalSystem: { select: { name: true } } },
  });

  const resolvedLaw = system?.name ?? article?.legalSystem?.name ?? article?.lawName ?? lawName;

  if (!system && !article) return { verdict: "النظام غير موجود بهذا الاسم", law_name: lawName };
  if (!article) {
    // HKM-033: الرقم قد يكون لمادة أُلغيت أو نُقلت بأداة لاحقة (مثل باب عقوبات نظام العمل بعد م/46)،
    // ونصها القديم محفوظ صفًّا تاريخيًّا (articleBis ≥ 100) بتحقق «ملغاة» وسنده. يُميَّز عن «غير موجودة».
    const historical = await repealedHistoryRow(system?.id ?? null, system?.name ?? lawName, n);
    if (historical) {
      return {
        verdict: historical.instrument ? `المادة ملغاة بموجب ${historical.instrument} — لا يُحتجّ بها نصًّا قائمًا` : "المادة ملغاة — لا يُحتجّ بها نصًّا قائمًا",
        law: resolvedLaw,
        article_number: articleNumber,
        article_bis: bis,
        repealed: true,
        status: "ملغاة",
        evidence_instrument: historical.instrument,
        historical_text: historical.content,
      };
    }
    return { verdict: "المادة غير موجودة في هذا النظام", law: resolvedLaw, article_number: articleNumber, article_bis: bis };
  }

  const [verification, effective] = await Promise.all([
    latestVerification("unit", article.id),
    effectiveArticleTexts([{ id: article.id, content: article.content }]),
  ]);
  const flags = citationFlagsFromVerification(verification);
  const e = effective.get(article.id);
  const actualText = e?.text ?? article.content;
  const amended = e?.source === "unit_version";
  const inForce = flags.inForce || amended;

  if (claimedText) {
    // مطابقة متسامحة: تتجاوز التشكيل والمسافات المتغيّرة. المرجع هو النص الساري.
    const norm = (s: string) => s.replace(/[ً-ٟ\s]+/g, "");
    const match = !flags.repealed && norm(actualText ?? "").includes(norm(claimedText));
    const matchesOld = !match && amended && norm(article.content ?? "").includes(norm(claimedText));
    return {
      verdict: flags.repealed
        ? (norm(article.content ?? "").includes(norm(claimedText)) ? "النص مطابق للنص المحفوظ — لكن المادة ملغاة" : "المادة ملغاة والنص المنسوب غير مطابق")
        : match
          ? (inForce ? "الإحالة صحيحة والنص مطابق" : "الإحالة صحيحة والنص مطابق — الحالة قيد التحقق")
          : matchesOld
            ? "النص المنسوب هو نص المادة قبل تعديلها — النص الساري مختلف"
            : "المادة موجودة لكن النص المنسوب غير مطابق",
      law: resolvedLaw,
      article_number: articleNumber,
      article_bis: bis,
      repealed: flags.repealed,
      status: amended && !flags.inForce ? "ساري" : flags.statusLabel,
      actual_text: actualText,
      text_basis: e?.basis ?? null,
      ref: articleRef(article.id, actualText),
    };
  }
  return {
    verdict: flags.repealed ? "الإحالة صحيحة — لكن المادة ملغاة" : inForce ? "الإحالة صحيحة" : "الإحالة صحيحة — الحالة قيد التحقق",
    law: resolvedLaw,
    article_number: articleNumber,
    article_bis: bis,
    repealed: flags.repealed,
    status: amended && !flags.inForce ? "ساري" : flags.statusLabel,
    actual_text: actualText,
    text_basis: e?.basis ?? null,
    // HKM-044: بصمة النص الساري؛ hakeem_check_ref يكشف لاحقًا تعديله أو إلغاءه.
    ref: articleRef(article.id, actualText),
  };
}

// HKM-044 المرحلة الأولى: أدوات SqlClient (الفهرس، البحث النصي، الاستناد، الدلالي) تأخذ القاعدة والاعتماديات من هنا.
export function mcpSql(): SqlClient {
  return prismaSqlClient(prisma);
}

export function mcpDeps() {
  return { effective: (rows: Array<{ id: string; content: string | null }>) => effectiveArticleTexts(rows), siteUrl: getSiteUrl() };
}
