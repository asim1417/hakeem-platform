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
import { redactPII } from "@/lib/modules/legal-core/rulings-search";
import { citationFlagsFromVerification } from "@/lib/modules/legal-core/verified-status";
import { latestVerification } from "@/lib/modules/legal-core/verification-read";
import { displayedSystem, hiddenArticleIds } from "@/lib/modules/legal-core/work-edition-read";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";
import { matchThesaurusConcepts } from "@/lib/modules/legal-thesaurus/concept-index";

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

// ١) البحث في المواد — يعيد استخدام محرّك البحث الهجين (BM25/postgres + دلالي + رسم معرفي).
export async function searchArticles(query: string, lawId?: string, limit = 10) {
  // حين يُطلب حصرٌ بنظام معيّن نوسّع سقف الجلب ثم نُصفّي (المحرّك لا يقيّد بالنظام).
  const fetchLimit = lawId ? Math.min(limit * 4, 30) : limit;
  const res = await hybridSearch({ q: query, limit: fetchLimit }).catch(() => null);
  const ranked = (res?.results ?? []).filter((r) => r.type === "article");

  // ترطيب من القاعدة لضمان حقول العقد الدقيقة (خاصّة law_id = معرّف النظام).
  const ids = ranked.map((r) => r.id);
  const rows = ids.length
    ? await prisma.legalArticle.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          legalSystemId: true,
          lawName: true,
          articleNumber: true,
          content: true,
          legalSystem: { select: { id: true, name: true } },
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const hidden = await hiddenArticleIds(rows.map((r) => r.id));
  const scoped = lawId ? await displayedSystem(lawId, new Date()) : null;
  const scopedLawId = scoped?.redirected ? scoped.id : lawId;
  const results = ranked
    .map((r) => byId.get(r.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter((r) => !hidden.has(r.id))
    .filter((r) => (scopedLawId ? r.legalSystemId === scopedLawId || r.legalSystem?.id === scopedLawId : true))
    .slice(0, limit)
    .map((r) => ({
      article_id: r.id,
      law: r.legalSystem?.name ?? r.lawName,
      law_id: r.legalSystem?.id ?? r.legalSystemId,
      article_number: r.articleNumber,
      snippet: snippet(r.content),
    }));

  return { query, count: results.length, results };
}

// ٢) نص المادة كاملًا
export async function getArticle(articleId: string) {
  const a = await prisma.legalArticle.findUnique({
    where: { id: articleId },
    include: { legalSystem: { select: { id: true, name: true } } },
  });
  if (!a) return { error: "المادة غير موجودة" };
  const route = a.legalSystemId ? await displayedSystem(a.legalSystemId, new Date()) : null;
  if (route?.redirected) {
    const alt = await prisma.legalArticle.findFirst({
      where: { legalSystemId: route.id, articleNumber: a.articleNumber },
      include: { legalSystem: { select: { id: true, name: true } } },
    });
    if (alt) {
      return {
        article_id: alt.id,
        law: alt.legalSystem?.name ?? alt.lawName,
        law_id: alt.legalSystem?.id ?? alt.legalSystemId,
        issued_by: route.instrument,
        issued_date_h: null,
        article_number: alt.articleNumber,
        status: route.status,
        text: alt.content,
      };
    }
  }
  return {
    article_id: a.id,
    law: a.legalSystem?.name ?? a.lawName,
    law_id: a.legalSystem?.id ?? a.legalSystemId,
    issued_by: a.royalDecree ?? null, // أداة الإصدار على مستوى المادة (المرسوم الملكي)
    issued_date_h: null, // لا يوجد تاريخ هجري منظّم في المخطط الحالي
    article_number: a.articleNumber,
    status: a.status ?? null,
    text: a.content,
  };
}

// ٣) بطاقة النظام وفهرسه
export async function getLaw(lawId?: string, name?: string) {
  const include = {
    articles: {
      select: { id: true, articleNumber: true, title: true },
      orderBy: { articleNumber: "asc" as const },
    },
  };
  const law = lawId
    ? await prisma.legalSystem.findUnique({ where: { id: lawId }, include })
    : await prisma.legalSystem.findFirst({
        where: { name: { contains: name ?? "", mode: "insensitive" } },
        include,
        orderBy: { articleCount: "desc" },
      });
  if (!law) return { error: "النظام غير موجود" };
  const route = await displayedSystem(law.id, new Date());
  if (route.redirected) {
    const edition = await prisma.legalSystem.findUnique({ where: { id: route.id }, include });
    if (edition) {
      return {
        law_id: edition.id,
        name: edition.name,
        classification: edition.classification ?? edition.domainTitle ?? edition.domain ?? null,
        issue_instrument: route.instrument,
        issue_date_h: null,
        status: route.status,
        articles_count: edition.articleCount || edition.articles.length,
        toc: edition.articles.map((x) => ({ article_id: x.id, number: x.articleNumber, title: x.title })),
      };
    }
  }
  return {
    law_id: law.id,
    name: law.name,
    classification: law.classification ?? law.domainTitle ?? law.domain ?? null,
    issue_instrument: null, // غير منظّم على مستوى النظام في المخطط الحالي
    issue_date_h: null,
    status: null, // حالة النفاذ مُخزّنة على مستوى المادة لا النظام
    articles_count: law.articleCount || law.articles.length,
    toc: law.articles.map((x) => ({ article_id: x.id, number: x.articleNumber, title: x.title })),
  };
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

// ٦) البحث في الأحكام — يعيد استخدام محرّك البحث الهجين (نوع «ruling»).
export async function searchRulings(query: string, court?: string, yearH?: number, limit = 10) {
  const res = await hybridSearch({
    q: query,
    limit: Math.min(limit * 4, 30),
    context: court ? { court } : undefined,
  }).catch(() => null);
  const ranked = (res?.results ?? []).filter((r) => r.type === "ruling");

  const ids = ranked.map((r) => r.id);
  const rows = ids.length
    ? await prisma.judicialCase.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          caseNo: true,
          decisionNo: true,
          court: true,
          decisionDate: true,
          decisionDateText: true,
          judgmentText: true,
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  /** استخراج سنة هجرية (٤ خانات) من نصّ التاريخ إن وُجد. */
  const hijriYear = (text?: string | null): number | undefined => {
    if (!text) return undefined;
    const m = text.match(/1[0-4]\d{2}/); // نطاق هجري معقول (1000–1499)
    return m ? Number.parseInt(m[0], 10) : undefined;
  };

  const results = ranked
    .map((r) => byId.get(r.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter((r) => (court ? (r.court ?? "").includes(court) : true))
    .filter((r) => (yearH ? hijriYear(r.decisionDateText) === yearH : true))
    .slice(0, limit)
    .map((r) => ({
      ruling_id: r.id,
      case_number: r.decisionNo ?? r.caseNo ?? null,
      court: r.court ?? null,
      year_h: hijriYear(r.decisionDateText) ?? null,
      snippet: snippet(r.judgmentText),
    }));

  return { query, count: results.length, results };
}

// ٧) حارس الإحالات — التحقق قبل العزو (يمنع اختلاق المواد).
export async function verifyCitation(lawName: string, articleNumber: string, claimedText?: string) {
  const n = toArticleNumber(articleNumber);
  if (n === null) return { verdict: "رقم المادة غير صالح", law_name: lawName, article_number: articleNumber };

  // حلّ اسم النظام بثبات (1.1): مطابقة تامّة/بادئة وحيدة فقط تُعدّ حاسمة (الاحتواء ليس حاسمًا).
  const resolved = await resolveLaw(lawName);
  if (!resolved.decisive || !resolved.system) {
    return { verdict: "النظام غير محسوم بهذا الاسم", law_name: lawName, candidates: resolved.candidates };
  }
  if (isNumberingShifted(resolved.system.name)) {
    return { verdict: "ترقيم النظام قيد التصحيح الرسميّ — لا يُعتدّ برقم المادة", law: resolved.system.name, article_number: articleNumber };
  }
  const route = await displayedSystem(resolved.system.id, new Date());
  const system = route.redirected
    ? { id: route.id, name: resolved.system.name, articleCount: resolved.system.articleCount }
    : resolved.system;

  // نبحث المادة عبر معرّف النظام إن وُجد، وإلا عبر اسم النظام على المادة مباشرة.
  const article = await prisma.legalArticle.findFirst({
    where: route.redirected
      ? { legalSystemId: route.id, articleNumber: n }
      : system
        ? { OR: [{ legalSystemId: system.id }, { lawName: system.name }], articleNumber: n }
        : { lawName: { contains: lawName, mode: "insensitive" }, articleNumber: n },
    select: { id: true, articleNumber: true, content: true, lawName: true, legalSystem: { select: { name: true } } },
  });

  const resolvedLaw = article?.legalSystem?.name ?? article?.lawName ?? system?.name ?? lawName;

  if (!system && !article) return { verdict: "النظام غير موجود بهذا الاسم", law_name: lawName };
  if (!article) return { verdict: "المادة غير موجودة في هذا النظام", law: resolvedLaw, article_number: articleNumber };

  const flags = route.status
    ? { inForce: route.status === "ساري", repealed: route.status === "مستبدل", statusLabel: route.status }
    : citationFlagsFromVerification(await latestVerification("unit", article.id));

  if (claimedText) {
    // مطابقة متسامحة: تتجاوز التشكيل والمسافات المتغيّرة.
    const norm = (s: string) => s.replace(/[ً-ٟ\s]+/g, "");
    const match = norm(article.content ?? "").includes(norm(claimedText));
    return {
      verdict: match
        ? (flags.repealed ? "الإحالة صحيحة والنص مطابق — لكن المادة ملغاة" : flags.inForce ? "الإحالة صحيحة والنص مطابق" : "الإحالة صحيحة والنص مطابق — الحالة قيد التحقق")
        : "المادة موجودة لكن النص المنسوب غير مطابق",
      law: resolvedLaw,
      article_number: articleNumber,
      repealed: flags.repealed,
      status: flags.statusLabel,
      actual_text: article.content,
    };
  }
  return {
    verdict: flags.repealed ? "الإحالة صحيحة — لكن المادة ملغاة" : flags.inForce ? "الإحالة صحيحة" : "الإحالة صحيحة — الحالة قيد التحقق",
    law: resolvedLaw,
    article_number: articleNumber,
    repealed: flags.repealed,
    status: flags.statusLabel,
    actual_text: article.content,
  };
}
