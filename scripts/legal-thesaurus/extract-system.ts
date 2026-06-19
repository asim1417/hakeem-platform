/**
 * extract-system.ts — استخراج المكنز من **كامل متن نظام واحد** (طيّار/pilot).
 *
 * يعالج كل مواد النظام من الأولى إلى الأخيرة (لا مواد التعريفات ولا أوائل المواد فقط):
 *   ① لقطة نصّ لكل مادة.  ② تعريفات صريحة (إن وُجدت).  ③ مسح المتن بمعجم المفاهيم
 *   المركّبة + الأزواج الدقيقة (منفصلة).  ④ تسجيل **مواضع الورود** بمواقعها ونِسَبها
 *   واقتباساتها.  ⑤ احتساب **برهان التكرار** (مواد/أنظمة/ورود) وتصنيف الموقع والنطاق.
 *   ⑥ التقاط عبارات مركّبة مرشّحة من كامل المتن للمراجعة.  ⑦ توليد تقارير:
 *      - legal-thesaurus-extraction-bias-report.md  (تشخيص الانحياز: تعريفات↔متن)
 *      - legal-thesaurus-coverage-report.md          (تغطية المتن + عيّنات بداية/وسط/نهاية)
 *      - concept-recurrence-report.md                (تكرار كل مفهوم بمواضعه ومواده وسنده)
 *
 * يكتب في **جداول المكنز الجديدة فقط** — لا يمسّ legal_articles/legal_systems.
 * طيّار على نظام واحد فقط — لا تعميم على القاعدة قبل اعتماد التقارير.
 *
 * 🔒 لا يعمل إلا بـ: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeText, searchableText, splitSentences, splitParagraphs, textHash } from "@/lib/modules/legal-thesaurus/normalize";
import { isDefinitionArticle, extractDefinedTerms, classifyConceptType } from "@/lib/modules/legal-thesaurus/definitions";
import { scanArticleForConcepts, scanCompoundPhrases, BODY_CONCEPT_LEXICON } from "@/lib/modules/legal-thesaurus/body-concepts";
import { scoreDefinedTerm, scoreBodyConcept, decideReview } from "@/lib/modules/legal-thesaurus/scoring";
import {
  classifyRecurrence, classifySourcePosition, positionRatioToClass, classifyScope, type RecurrenceStrength, type SourcePosition,
} from "@/lib/modules/legal-thesaurus/recurrence";

const exec = (sql: string, ...a: unknown[]) => prisma.$executeRawUnsafe(sql, ...a);
const query = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);

async function bulkInsert(table: string, cols: string[], rows: unknown[][], conflict = ""): Promise<void> {
  const CHUNK = 80;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    let p = 0;
    const tuples = chunk.map((r) => "(" + r.map((v) => { params.push(v); return `$${++p}`; }).join(",") + ")");
    await exec(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${tuples.join(",")} ${conflict}`, ...params);
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface ArticleRow { id: string; lawName: string; legalSystemId: string | null; articleNumber: string | number | null; title: string | null; content: string; status: string | null; }

interface OccRecord {
  articleId: string; sourceId: string | null; sourceName: string; articleNumber: string;
  ratio: number; matchType: string; evidence: string; type: "definition" | "body_usage"; count: number;
}

interface ConceptAgg {
  id: string; label: string; normLabel: string; type: string; domain: string | null; carefulGroup?: string; isCompound: boolean;
  hasDef: boolean; hasBody: boolean; defScore: number; defText: string; defEvidence: string; defArticleId: string | null;
  occ: OccRecord[]; exactMatch: boolean;
  discovered?: boolean; // مفهوم مُرقّى من اكتشاف المتن (نمط مركّب، لا معجم)
  realTotalOcc?: number; realDistinctArticles?: number; realDistinctSources?: number; // إجماليات حقيقية (المواضع المخزّنة عيّنة)
}

/** تجميع عبارة مركّبة مُكتشَفة من المتن قبل ترقيتها مفهوماً. */
interface DiscoveredAgg {
  phrase: string; normLabel: string; count: number; articles: Set<string>; sources: Set<string>; occ: OccRecord[];
}

function aggKey(label: string): string { return searchableText(label); }

async function main() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ مقفول. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED."); process.exit(1);
  }
  const wantSystem = arg("--system");
  const wantSystemId = arg("--system-id");
  const reset = process.argv.includes("--reset");
  const all = process.argv.includes("--all"); // تعميم على كامل القاعدة
  const topCandidates = Number(arg("--top") ?? 40);

  const tcheck = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!tcheck.length || Number(tcheck[0].c) === 0) { console.error("✗ جداول المكنز غير موجودة (طبّق 001 ثم 002)."); process.exit(1); }
  // التحقق من أعمدة 002
  const colCheck = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.columns WHERE table_name='legal_thesaurus_concepts' AND column_name='recurrence_strength'`).catch(() => []);
  if (!colCheck.length || Number(colCheck[0].c) === 0) { console.error("✗ أعمدة 002 غير مطبّقة (recurrence_strength مفقود). طبّق 002-occurrence-recurrence.sql."); process.exit(1); }

  // ── الأنظمة (مجمّعة بالاسم مع عدد موادها) ──
  const groups = await query<{ law: string; n: number; sid: string | null }>(
    `SELECT a."lawName" AS law, count(*)::int AS n, min(a."legalSystemId") AS sid
     FROM legal_articles a WHERE a."lawName" IS NOT NULL GROUP BY a."lawName" ORDER BY n DESC`
  );
  if (!groups.length) { console.error("✗ لا أنظمة."); process.exit(1); }

  // اختيار نظام الطيّار (إن لم يكن تعميماً)
  let chosen = groups[0];
  if (wantSystemId) {
    const g = groups.find((x) => x.sid === wantSystemId);
    if (g) chosen = g;
  } else if (wantSystem) {
    const needle = searchableText(wantSystem);
    const matches = groups.filter((x) => searchableText(x.law).includes(needle));
    if (matches.length) chosen = matches.sort((a, b) => b.n - a.n)[0];
    else console.warn(`⚠ لا نظام يطابق «${wantSystem}» — سيُختار الأطول.`);
  }

  if (reset) {
    for (const t of ["legal_thesaurus_occurrences","legal_thesaurus_definitions","legal_thesaurus_terms","legal_thesaurus_candidate_terms","legal_thesaurus_review_queue","legal_thesaurus_concepts","legal_thesaurus_text_snapshots"]) {
      await exec(`TRUNCATE TABLE ${t} CASCADE`).catch(() => 0);
    }
    console.log("♻ أُفرغت جداول محتوى المكنز الجديدة (الأصلية والمجالات لم تُمسّ).");
  }

  const runId = randomUUID();
  const scopeLabel = all ? "كامل القاعدة" : chosen.law;
  await exec(`INSERT INTO legal_thesaurus_extraction_runs (id, run_type, status, source_scope, batch_size, total_articles) VALUES ($1,$2,'running',$3,$4,$5)`,
    runId, all ? "full_body_full_db" : "full_body_system_pilot", scopeLabel.slice(0, 200), 0, 0);

  // ── الحالة المشتركة (تجميع المفاهيم عالمياً عبر الأنظمة) ──
  const concepts = new Map<string, ConceptAgg>();
  const discovered = new Map<string, DiscoveredAgg>(); // عبارات مركّبة مُكتشَفة من المتن
  const lexiconNorms = new Set(BODY_CONCEPT_LEXICON.map((e) => searchableText(e.label)));
  let defArticles = 0, bodyTouchedArticles = 0, total = 0;
  const perSystemCoverage: Array<{ law: string; total: number; touched: number }> = [];

  const ensure = (label: string, type: string, domain: string | null, isCompound: boolean, carefulGroup?: string): ConceptAgg => {
    const k = aggKey(label);
    let c = concepts.get(k);
    if (!c) {
      c = { id: randomUUID(), label, normLabel: k, type, domain, carefulGroup, isCompound, hasDef: false, hasBody: false, defScore: 0, defText: "", defEvidence: "", defArticleId: null, occ: [], exactMatch: false };
      concepts.set(k, c);
    }
    return c;
  };

  // يعالج مادة واحدة: تعريفات صريحة + مسح المتن + مرشّحات مركّبة. يُرجِع true إن مسّها المتن.
  const processArticle = (a: ArticleRow, ratio: number): boolean => {
    const artNum = String(a.articleNumber ?? "");
    if (isDefinitionArticle(a.content, a.title ?? undefined)) {
      defArticles += 1;
      for (const d of extractDefinedTerms(a.content)) {
        const c = ensure(d.term, classifyConceptType(d.term, d.definition), null, d.term.split(/\s+/).length > 1, undefined);
        const score = scoreDefinedTerm({ definitionLength: d.definition.length, sourceStatus: a.status, termWordCount: d.term.split(/\s+/).length });
        if (!c.hasDef || score > c.defScore) { c.defScore = score; c.defText = d.definition; c.defEvidence = `${d.term}: ${d.definition}`.slice(0, 400); c.defArticleId = a.id; }
        c.hasDef = true;
        c.occ.push({ articleId: a.id, sourceId: a.legalSystemId, sourceName: a.lawName, articleNumber: artNum, ratio, matchType: "exact_label_match", evidence: `${d.term}: ${d.definition}`.slice(0, 300), type: "definition", count: 1 });
      }
    }
    let touched = false;
    for (const hit of scanArticleForConcepts(a.content)) {
      touched = true;
      const c = ensure(hit.entry.label, hit.entry.type, hit.entry.domain, hit.entry.isCompound, hit.entry.carefulGroup);
      c.hasBody = true;
      if (hit.matchType === "exact_label_match") c.exactMatch = true;
      c.occ.push({ articleId: a.id, sourceId: a.legalSystemId, sourceName: a.lawName, articleNumber: artNum, ratio, matchType: hit.matchType, evidence: hit.evidence, type: "body_usage", count: hit.count });
    }
    // اكتشاف العبارات المركّبة من كامل المتن (للترقية مفاهيم أو للمراجعة)
    for (const cp of scanCompoundPhrases(a.content)) {
      const norm = searchableText(cp.phrase);
      if (!norm || lexiconNorms.has(norm)) continue; // المعجم يفوز
      let dd = discovered.get(norm);
      if (!dd) { dd = { phrase: cp.phrase, normLabel: norm, count: 0, articles: new Set(), sources: new Set(), occ: [] }; discovered.set(norm, dd); }
      dd.count += cp.count;
      dd.articles.add(a.id);
      dd.sources.add(a.legalSystemId ?? "");
      if (dd.occ.length < 5) dd.occ.push({ articleId: a.id, sourceId: a.legalSystemId, sourceName: a.lawName, articleNumber: artNum, ratio, matchType: "variant_match", evidence: cp.evidence, type: "body_usage", count: cp.count });
    }
    return touched;
  };

  // يعالج كل مواد نظام واحد (النسبة تُحسب داخل النظام)؛ يكتب اللقطات للنظام المفرد فقط.
  const runSystem = async (law: string, withSnapshots: boolean): Promise<ArticleRow[]> => {
    const arts = await query<ArticleRow>(
      `SELECT id, "lawName", "legalSystemId", "articleNumber", title, content, status
       FROM legal_articles WHERE "lawName" = $1 ORDER BY "articleNumber" ASC NULLS LAST, id ASC`, law
    );
    const n = arts.length; let touchedCount = 0;
    for (let i = 0; i < n; i++) {
      const a = arts[i];
      const ratio = n > 1 ? i / (n - 1) : 0;
      if (withSnapshots) {
        await exec(
          `INSERT INTO legal_thesaurus_text_snapshots (id, article_id, legal_source_id, original_text, normalized_text, searchable_text, sentences_json, paragraphs_json, text_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (article_id) DO NOTHING`,
          randomUUID(), a.id, a.legalSystemId, a.content, normalizeText(a.content), searchableText(a.content),
          JSON.stringify(splitSentences(a.content)), JSON.stringify(splitParagraphs(a.content)), textHash(a.content)
        ).catch(() => 0);
      }
      if (processArticle(a, ratio)) { touchedCount += 1; bodyTouchedArticles += 1; }
    }
    perSystemCoverage.push({ law, total: n, touched: touchedCount });
    total += n;
    return arts;
  };

  // ── التنفيذ: تعميم على الكل، أو طيّار على نظام واحد ──
  let pilotArticles: ArticleRow[] = [];
  if (all) {
    console.log(`🌐 تعميم على كامل القاعدة — ${groups.length} نظاماً.`);
    let done = 0;
    for (const g of groups) {
      await runSystem(g.law, false); // بلا لقطات (توفير وقت/مساحة عند التعميم)
      done += 1;
      if (done % 50 === 0) console.log(`  … ${done}/${groups.length} نظاماً (${total} مادة، ${concepts.size} مفهوماً حتى الآن)`);
    }
  } else {
    console.log(`🎯 النظام المختار (الطيّار): «${chosen.law}» — ${chosen.n} مادة.`);
    pilotArticles = await runSystem(chosen.law, true);
    if (!total) { console.error("✗ لا مواد للنظام."); process.exit(1); }
  }

  // ── ترقية العبارات المركّبة المُكتشَفة إلى مفاهيم مُسنَدة (متكرّرة في مواد متعددة) ──
  // العتبة: ≥3 ورود في ≥2 مادة. ما دونها يبقى مرشّحاً للمراجعة فقط.
  const PROMOTE_MIN_OCC = 3, PROMOTE_MIN_ARTS = 2;
  let promoted = 0;
  const leftoverCandidates: Array<[string, number]> = [];
  for (const dd of discovered.values()) {
    const qualifies = dd.count >= PROMOTE_MIN_OCC && dd.articles.size >= PROMOTE_MIN_ARTS;
    if (!qualifies || concepts.has(dd.normLabel)) { leftoverCandidates.push([dd.phrase, dd.count]); continue; }
    const c = ensure(dd.phrase, classifyConceptType(dd.phrase, ""), null, dd.phrase.split(/\s+/).length > 1, undefined);
    c.hasBody = true;
    c.discovered = true;
    c.realTotalOcc = dd.count;
    c.realDistinctArticles = dd.articles.size;
    c.realDistinctSources = dd.sources.size;
    for (const o of dd.occ) c.occ.push(o); // عيّنة مواضع (≤5) كدليل
    promoted += 1;
  }
  console.log(`🧩 عبارات مركّبة مُكتشَفة: ${discovered.size} · مُرقّاة مفاهيم: ${promoted} · مرشّحات مراجعة متبقّية: ${leftoverCandidates.length}`);

  // ── احتساب التكرار والموقع والكتابة ──
  const lexiconLabels = new Set(BODY_CONCEPT_LEXICON.map((e) => searchableText(e.label)));
  const conceptRows: Array<{ a: ConceptAgg; rec: RecurrenceStrength; pos: SourcePosition; scope: string; basis: string; score: number; needsReview: boolean; dist: Record<string, number>; firstId: string; strongId: string; firstRatio: number; total: number; arts: number; sources: number }> = [];
  const occRows: unknown[][] = [], defRows: unknown[][] = [], termRows: unknown[][] = [];

  for (const c of concepts.values()) {
    // للمفاهيم المُرقّاة: الإجماليات الحقيقية محفوظة (المواضع المخزّنة عيّنة ≤5).
    const distinctArticles = c.realDistinctArticles ?? new Set(c.occ.map((o) => o.articleId)).size;
    const distinctSources = c.realDistinctSources ?? new Set(c.occ.map((o) => o.sourceId ?? c.label)).size;
    const totalOcc = c.realTotalOcc ?? c.occ.reduce((s, o) => s + o.count, 0);
    const ratios = c.occ.map((o) => o.ratio);
    const rec = classifyRecurrence({ totalOccurrences: totalOcc, distinctArticles, distinctSources });
    const pos = classifySourcePosition(ratios);
    const scope = classifyScope(c.hasDef, c.hasBody);
    const basis = c.hasDef && c.hasBody ? "mixed_definition_and_body" : c.hasDef ? "explicit_legal_definition" : c.discovered ? "body_pattern" : "body_usage";
    const score = c.hasDef
      ? Math.max(c.defScore, scoreBodyConcept({ isCompound: c.isCompound, distinctArticles, totalOccurrences: totalOcc, exactMatch: c.exactMatch, hasExplicitDefinition: true }))
      : scoreBodyConcept({ isCompound: c.isCompound, distinctArticles, totalOccurrences: totalOcc, exactMatch: c.exactMatch, hasExplicitDefinition: false });
    const needsReview = decideReview(score).needsReview;
    // توزيع المواقع
    const dist = { early_articles: 0, middle_articles: 0, late_articles: 0 } as Record<string, number>;
    for (const r of ratios) dist[positionRatioToClass(r)] += 1;
    // أول مادة (أصغر ترتيب) وأقوى مادة (أكثر ورود)
    const sortedByRatio = [...c.occ].sort((x, y) => x.ratio - y.ratio);
    const firstId = sortedByRatio[0]?.articleId ?? c.occ[0]?.articleId ?? "";
    const firstRatio = sortedByRatio[0]?.ratio ?? 0;
    const strongId = [...c.occ].sort((x, y) => y.count - x.count)[0]?.articleId ?? firstId;
    conceptRows.push({ a: c, rec, pos, scope, basis, score, needsReview, dist, firstId, strongId, firstRatio, total: totalOcc, arts: distinctArticles, sources: distinctSources });

    // مواضع
    for (const o of c.occ) {
      occRows.push([randomUUID(), c.id, o.articleId, o.sourceId, Number.isFinite(Number(o.articleNumber)) ? Number(o.articleNumber) : null, o.evidence, o.type, o.sourceName, o.matchType, score, o.ratio]);
    }
    // مصطلح مفضّل
    termRows.push([randomUUID(), c.id, c.label, c.normLabel, "preferred", score, needsReview ? "candidate" : "approved"]);
    // تعريف (إن وُجد)
    if (c.hasDef && c.defArticleId) defRows.push([randomUUID(), c.id, c.defText, "explicit_legal_definition", c.defArticleId, c.defEvidence, c.defScore, "candidate"]);
  }

  // إدخال المفاهيم دفعةً (bulk) — تحسين تقني فقط، بلا تغيير في القيم؛ العمود jsonb يُحقن بـ ::jsonb.
  const CONCEPT_COLS = ["id","preferred_label_ar","normalized_label","concept_type","legal_domain_primary","definition_type","definition_text","confidence_score","source_basis","status","needs_human_review","extraction_scope","source_position","article_position_ratio","total_occurrences_count","distinct_articles_count","distinct_sources_count","first_occurrence_article_id","strongest_occurrence_article_id","occurrence_distribution_json","recurrence_strength"];
  const conceptTuples = conceptRows.map((r) => {
    const c = r.a;
    return [c.id, c.label, c.normLabel, c.type, c.domain, c.hasDef ? "explicit_legal_definition" : "contextual_usage", c.hasDef ? c.defText : null,
      r.score, r.basis, r.needsReview ? "candidate" : "approved", r.needsReview,
      r.scope, r.pos, r.firstRatio, r.total, r.arts, r.sources,
      r.firstId, r.strongId, JSON.stringify(r.dist), r.rec];
  });
  const JSONB_IDX = CONCEPT_COLS.indexOf("occurrence_distribution_json"); // عمود jsonb الوحيد
  const CHUNK = 80;
  for (let i = 0; i < conceptTuples.length; i += CHUNK) {
    const chunk = conceptTuples.slice(i, i + CHUNK);
    const params: unknown[] = [];
    let p = 0;
    const tuples = chunk.map((row) => "(" + row.map((v, col) => { params.push(v); p += 1; return col === JSONB_IDX ? `$${p}::jsonb` : `$${p}`; }).join(",") + ")");
    await exec(`INSERT INTO legal_thesaurus_concepts (${CONCEPT_COLS.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT (normalized_label) DO NOTHING`, ...params)
      .catch((e) => { console.error("concept bulk insert:", e instanceof Error ? e.message.split("\n")[0] : e); });
  }
  await bulkInsert("legal_thesaurus_occurrences", ["id","concept_id","article_id","legal_source_id","article_number","occurrence_text","occurrence_type","legal_source_name","match_type","confidence_score","article_position_ratio"], occRows);
  await bulkInsert("legal_thesaurus_terms", ["id","concept_id","term_text","normalized_term","term_type","confidence_score","status"], termRows);
  await bulkInsert("legal_thesaurus_definitions", ["id","concept_id","definition_text","definition_type","source_article_id","evidence_quote","confidence_score","status"], defRows);

  // عبارات مركّبة مرشّحة لم تُرقَّ (للمراجعة فقط) — تكرار دون العتبة
  void lexiconLabels;
  const candPhrases = leftoverCandidates.sort((a, b) => b[1] - a[1]).slice(0, topCandidates);
  const candRows: unknown[][] = [], reviewRows: unknown[][] = [];
  for (const [phrase, count] of candPhrases) {
    const cid = randomUUID();
    candRows.push([cid, phrase, searchableText(phrase), phrase.length, "compound_body_phrase", null, all ? null : chosen.sid, null, phrase.slice(0, 200), "body_compound_pattern", 0, "auto_candidate", runId]);
    reviewRows.push([randomUUID(), "candidate_term", cid, "compound_phrase_needs_classification", "review_classify_or_reject", JSON.stringify({ phrase, count, system: scopeLabel }), "pending"]);
  }
  await bulkInsert("legal_thesaurus_candidate_terms", ["id","term_text","normalized_term","term_length","term_type_candidate","source_article_id","legal_source_id","article_number","evidence_quote","extraction_method","confidence_score","status","run_id"], candRows);
  for (const r of reviewRows) {
    await exec(`INSERT INTO legal_thesaurus_review_queue (id, item_type, item_id, issue_type, proposed_action, evidence_json, status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`, ...r).catch(() => 0);
  }

  await exec(`UPDATE legal_thesaurus_extraction_runs SET status='completed', finished_at=now(), total_articles=$2, processed_articles=$2, created_concepts=$3, created_terms=$4 WHERE id=$1`, runId, total, conceptRows.length, termRows.length).catch(() => 0);

  // ── التقارير ──
  if (all) {
    writeGlobalReport({ systemsCount: groups.length, total, defArticles, bodyTouchedArticles, perSystemCoverage, conceptRows, candPhrases });
  } else {
    writeReports({ system: chosen.law, total, defArticles, bodyTouchedArticles, articles: pilotArticles, conceptRows, candPhrases });
  }

  console.log("\n" + "=".repeat(64));
  console.log(`📊 ${all ? "تعميم كامل القاعدة" : "الطيّار: «" + chosen.law + "»"} — ${total} مادة` + (all ? ` عبر ${groups.length} نظاماً` : ""));
  console.log(`مواد تعريفات: ${defArticles} · مواد مسّها المتن: ${bodyTouchedArticles} (${total ? ((bodyTouchedArticles / total) * 100).toFixed(1) : 0}%)`);
  console.log(`مفاهيم: ${conceptRows.length} · مواضع: ${occRows.length} · مرشّحات مركّبة للمراجعة: ${candRows.length}`);
  console.log(`✅ التقارير في out/legal-thesaurus/ (bias · coverage · recurrence).`);
}

// ════════════════════════════════════════════════════════════════════════
// توليد التقارير (Markdown)
// ════════════════════════════════════════════════════════════════════════
interface ReportCtx {
  system: string; total: number; defArticles: number; bodyTouchedArticles: number; articles: ArticleRow[];
  conceptRows: Array<{ a: ConceptAgg; rec: RecurrenceStrength; pos: SourcePosition; scope: string; basis: string; score: number; needsReview: boolean; dist: Record<string, number>; firstId: string; strongId: string; firstRatio: number }>;
  candPhrases: Array<[string, number]>;
}

function writeReports(ctx: ReportCtx) {
  const outDir = path.join(process.cwd(), "out", "legal-thesaurus");
  fs.mkdirSync(outDir, { recursive: true });
  const esc = (s: string) => (s || "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 220);

  const defOnly = ctx.conceptRows.filter((r) => r.a.hasDef);
  const bodyOnly = ctx.conceptRows.filter((r) => r.a.hasBody && !r.a.hasDef);
  const mixed = ctx.conceptRows.filter((r) => r.a.hasDef && r.a.hasBody);
  const posCount = (rows: typeof ctx.conceptRows, p: string) => rows.filter((r) => r.pos === p || (p === "all_system" && r.pos === "all_system")).length;

  // ── تقرير الانحياز ──
  const bias: string[] = [];
  bias.push(`# تقرير تشخيص الانحياز — الاستخراج من التعريفات مقابل كامل المتن`);
  bias.push(`\nالنظام (طيّار): **${ctx.system}** — ${ctx.total} مادة.\n`);
  bias.push(`## المشكلة المُشخَّصة`);
  bias.push(`الاستخراج القديم اقتصر على **مواد التعريفات** (و«يقصد بـ») وهي تقع غالباً في **أوائل** النظام، فينحاز المكنز إلى بداية النظام ويُهمل قواعد المتن (الشروط/الآثار/الإجراءات/الجزاءات) المنتشرة في الوسط والنهاية.\n`);
  bias.push(`## القياس على هذا النظام`);
  bias.push(`| المقياس | تعريفات فقط (القديم) | كامل المتن (الجديد) |`);
  bias.push(`|---|---:|---:|`);
  bias.push(`| مواد ساهمت في الاستخراج | ${ctx.defArticles} | ${ctx.bodyTouchedArticles} |`);
  bias.push(`| نسبة تغطية المواد | ${((ctx.defArticles / ctx.total) * 100).toFixed(1)}% | ${((ctx.bodyTouchedArticles / ctx.total) * 100).toFixed(1)}% |`);
  bias.push(`| مفاهيم من تعريفات صريحة | ${defOnly.length} | — |`);
  bias.push(`| مفاهيم من المتن (بلا تعريف صريح) | 0 | ${bodyOnly.length} |`);
  bias.push(`| مفاهيم بسند مزدوج (تعريف+متن) | — | ${mixed.length} |`);
  bias.push(`| **إجمالي المفاهيم** | ${defOnly.length} | ${ctx.conceptRows.length} |\n`);
  bias.push(`## توزيع المفاهيم على موقع النظام (برهان رفع الانحياز)`);
  bias.push(`| الموقع | عدد المفاهيم |`);
  bias.push(`|---|---:|`);
  for (const p of ["early_articles", "middle_articles", "late_articles", "all_system"]) bias.push(`| ${p} | ${posCount(ctx.conceptRows, p)} |`);
  bias.push(`\nوجود مفاهيم مصنّفة \`middle_articles\`/\`late_articles\`/\`all_system\` يثبت أن الاستخراج لم يعد محصوراً في أوائل المواد.\n`);
  fs.writeFileSync(path.join(outDir, "legal-thesaurus-extraction-bias-report.md"), bias.join("\n") + "\n");

  // ── تقرير التغطية + عيّنات بداية/وسط/نهاية ──
  const cov: string[] = [];
  cov.push(`# تقرير تغطية المتن — ${ctx.system}`);
  cov.push(`\n- إجمالي المواد: **${ctx.total}**`);
  cov.push(`- مواد مسّها الاستخراج من المتن: **${ctx.bodyTouchedArticles}** (${((ctx.bodyTouchedArticles / ctx.total) * 100).toFixed(1)}%)`);
  cov.push(`- مواد تعريفات: **${ctx.defArticles}**`);
  cov.push(`- إجمالي المفاهيم: **${ctx.conceptRows.length}**\n`);

  const byArticle = new Map<string, string[]>();
  for (const r of ctx.conceptRows) for (const o of r.a.occ) {
    if (o.type !== "body_usage") continue;
    const arr = byArticle.get(o.articleId) ?? [];
    if (!arr.includes(r.a.label)) arr.push(r.a.label);
    byArticle.set(o.articleId, arr);
  }
  const sampleAt = (frac: number) => ctx.articles[Math.min(ctx.articles.length - 1, Math.max(0, Math.floor(frac * (ctx.articles.length - 1))))];
  const sections: Array<[string, number[]]> = [["بداية النظام", [0.0, 0.03, 0.06]], ["وسط النظام", [0.47, 0.5, 0.53]], ["نهاية النظام", [0.94, 0.97, 1.0]]];
  for (const [title, fracs] of sections) {
    cov.push(`## عيّنة — ${title}`);
    for (const f of fracs) {
      const a = sampleAt(f);
      if (!a) continue;
      const labels = byArticle.get(a.id) ?? [];
      cov.push(`\n**المادة ${a.articleNumber ?? "?"}** (موقع ${(f * 100).toFixed(0)}%) — مفاهيم مُستخرَجة: ${labels.length ? labels.map((l) => `\`${l}\``).join("، ") : "لا شيء"}`);
      cov.push(`> ${esc(a.content)}`);
    }
    cov.push("");
  }
  fs.writeFileSync(path.join(outDir, "legal-thesaurus-coverage-report.md"), cov.join("\n") + "\n");

  // ── تقرير التكرار ──
  const rec: string[] = [];
  rec.push(`# تقرير التكرار — ${ctx.system}`);
  rec.push(`\nكل مفهوم متكرر مُثبت بمواضعه (مواد + ورود + اقتباس). لا اعتماد على العدد وحده.\n`);
  rec.push(`| المفهوم | النوع | النطاق | الموقع | قوّة التكرار | ورود | مواد | الثقة | مراجعة |`);
  rec.push(`|---|---|---|---|---|---:|---:|---:|:--:|`);
  const sorted = [...ctx.conceptRows].sort((x, y) => y.a.occ.reduce((s, o) => s + o.count, 0) - x.a.occ.reduce((s, o) => s + o.count, 0));
  for (const r of sorted) {
    const tot = r.a.occ.reduce((s, o) => s + o.count, 0);
    const arts = new Set(r.a.occ.map((o) => o.articleId)).size;
    rec.push(`| ${esc(r.a.label)} | ${r.a.type} | ${r.scope} | ${r.pos} | ${r.rec} | ${tot} | ${arts} | ${r.score} | ${r.needsReview ? "نعم" : "لا"} |`);
  }
  rec.push(`\n## أدلّة المواضع (أعلى ١٥ مفهوماً)`);
  for (const r of sorted.slice(0, 15)) {
    const tot = r.a.occ.reduce((s, o) => s + o.count, 0);
    const arts = new Set(r.a.occ.map((o) => o.articleId)).size;
    rec.push(`\n### ${r.a.label} — ${r.rec} (${tot} ورود في ${arts} مادة)`);
    if (r.a.carefulGroup) rec.push(`- زوج دقيق: \`${r.a.carefulGroup}\` — يبقى منفصلاً (لا يُدمج).`);
    for (const o of r.a.occ.slice(0, 3)) rec.push(`- المادة ${o.articleNumber} (${o.matchType}): «${esc(o.evidence)}»`);
  }
  if (ctx.candPhrases.length) {
    rec.push(`\n## عبارات مركّبة مرشّحة من كامل المتن (للمراجعة — خارج المعجم)`);
    for (const [p, c] of ctx.candPhrases.slice(0, 25)) rec.push(`- \`${esc(p)}\` — ${c} ورود`);
  }
  fs.writeFileSync(path.join(outDir, "concept-recurrence-report.md"), rec.join("\n") + "\n");
}

// ── تقرير التعميم على كامل القاعدة ──
interface GlobalReportCtx {
  systemsCount: number; total: number; defArticles: number; bodyTouchedArticles: number;
  perSystemCoverage: Array<{ law: string; total: number; touched: number }>;
  conceptRows: Array<{ a: ConceptAgg; rec: RecurrenceStrength; pos: SourcePosition; scope: string; basis: string; score: number; needsReview: boolean; dist: Record<string, number>; firstId: string; strongId: string; firstRatio: number }>;
  candPhrases: Array<[string, number]>;
}

function writeGlobalReport(ctx: GlobalReportCtx) {
  const outDir = path.join(process.cwd(), "out", "legal-thesaurus");
  fs.mkdirSync(outDir, { recursive: true });
  const esc = (s: string) => (s || "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 220);
  const sorted = [...ctx.conceptRows].sort((x, y) => y.a.occ.reduce((s, o) => s + o.count, 0) - x.a.occ.reduce((s, o) => s + o.count, 0));
  const count = (pred: (r: GlobalReportCtx["conceptRows"][number]) => boolean) => ctx.conceptRows.filter(pred).length;

  // ① الانحياز/التغطية العالمي
  const bias: string[] = [];
  bias.push(`# تقرير التعميم على كامل القاعدة — الاستخراج من كامل متون الأنظمة`);
  bias.push(`\n- عدد الأنظمة: **${ctx.systemsCount}**`);
  bias.push(`- إجمالي المواد: **${ctx.total}**`);
  bias.push(`- مواد مسّها الاستخراج من المتن: **${ctx.bodyTouchedArticles}** (${ctx.total ? ((ctx.bodyTouchedArticles / ctx.total) * 100).toFixed(1) : 0}%)`);
  bias.push(`- مواد تعريفات: **${ctx.defArticles}**`);
  bias.push(`- إجمالي المفاهيم: **${ctx.conceptRows.length}**\n`);
  bias.push(`## توزيع المفاهيم حسب نطاق الاستخراج`);
  bias.push(`| النطاق | عدد |`); bias.push(`|---|---:|`);
  for (const s of ["full_body", "mixed", "definitions_only"]) bias.push(`| ${s} | ${count((r) => r.scope === s)} |`);
  bias.push(`\n## توزيع المفاهيم حسب قوّة التكرار`);
  bias.push(`| قوّة التكرار | عدد |`); bias.push(`|---|---:|`);
  for (const s of ["high_frequency_core_concept", "repeated_across_systems", "repeated_in_same_system", "repeated_in_same_article", "single_occurrence"]) bias.push(`| ${s} | ${count((r) => r.rec === s)} |`);
  bias.push(`\n## توزيع المفاهيم حسب الموقع`);
  bias.push(`| الموقع | عدد |`); bias.push(`|---|---:|`);
  for (const s of ["all_system", "early_articles", "middle_articles", "late_articles"]) bias.push(`| ${s} | ${count((r) => r.pos === s)} |`);
  bias.push(`\n**برهان التكرار عبر الأنظمة:** ${count((r) => r.rec === "repeated_across_systems" || new Set(r.a.occ.map((o) => o.sourceId)).size >= 2)} مفهوماً ورد في نظامين أو أكثر.`);
  fs.writeFileSync(path.join(outDir, "legal-thesaurus-extraction-bias-report.md"), bias.join("\n") + "\n");

  // ② التغطية لكل نظام
  const cov: string[] = [];
  cov.push(`# تقرير التغطية لكل نظام — كامل القاعدة`);
  cov.push(`\nإجمالي ${ctx.systemsCount} نظاماً · ${ctx.total} مادة · نسبة التغطية الكلية ${ctx.total ? ((ctx.bodyTouchedArticles / ctx.total) * 100).toFixed(1) : 0}%.\n`);
  const byCov = [...ctx.perSystemCoverage].sort((a, b) => (b.touched / Math.max(1, b.total)) - (a.touched / Math.max(1, a.total)));
  cov.push(`## أعلى ٢٥ نظاماً تغطيةً`);
  cov.push(`| النظام | مواد | مَمسوسة | % |`); cov.push(`|---|---:|---:|---:|`);
  for (const s of byCov.slice(0, 25)) cov.push(`| ${esc(s.law)} | ${s.total} | ${s.touched} | ${((s.touched / Math.max(1, s.total)) * 100).toFixed(0)}% |`);
  cov.push(`\n## أدنى ٢٥ نظاماً تغطيةً (فرص توسعة المعجم)`);
  cov.push(`| النظام | مواد | مَمسوسة | % |`); cov.push(`|---|---:|---:|---:|`);
  for (const s of byCov.filter((x) => x.total >= 10).slice(-25).reverse()) cov.push(`| ${esc(s.law)} | ${s.total} | ${s.touched} | ${((s.touched / Math.max(1, s.total)) * 100).toFixed(0)}% |`);
  fs.writeFileSync(path.join(outDir, "legal-thesaurus-coverage-report.md"), cov.join("\n") + "\n");

  // ③ التكرار العالمي (أعلى المفاهيم بمواضعها وأنظمتها)
  const rec: string[] = [];
  rec.push(`# تقرير التكرار — كامل القاعدة`);
  rec.push(`\nكل مفهوم مُثبت بمواضعه (مواد + أنظمة + ورود + اقتباس). لا اعتماد على العدد وحده.\n`);
  rec.push(`| المفهوم | النوع | النطاق | الموقع | قوّة التكرار | ورود | مواد | أنظمة | الثقة | مراجعة |`);
  rec.push(`|---|---|---|---|---|---:|---:|---:|---:|:--:|`);
  for (const r of sorted) {
    const tot = r.a.occ.reduce((s, o) => s + o.count, 0);
    const arts = new Set(r.a.occ.map((o) => o.articleId)).size;
    const srcs = new Set(r.a.occ.map((o) => o.sourceId ?? r.a.label)).size;
    rec.push(`| ${esc(r.a.label)} | ${r.a.type} | ${r.scope} | ${r.pos} | ${r.rec} | ${tot} | ${arts} | ${srcs} | ${r.score} | ${r.needsReview ? "نعم" : "لا"} |`);
  }
  rec.push(`\n## أدلّة المواضع (أعلى ٢٠ مفهوماً)`);
  for (const r of sorted.slice(0, 20)) {
    const tot = r.a.occ.reduce((s, o) => s + o.count, 0);
    const arts = new Set(r.a.occ.map((o) => o.articleId)).size;
    const srcs = new Set(r.a.occ.map((o) => o.sourceId ?? r.a.label)).size;
    rec.push(`\n### ${r.a.label} — ${r.rec} (${tot} ورود · ${arts} مادة · ${srcs} نظام)`);
    if (r.a.carefulGroup) rec.push(`- زوج دقيق: \`${r.a.carefulGroup}\` — يبقى منفصلاً (لا يُدمج).`);
    for (const o of r.a.occ.slice(0, 3)) rec.push(`- ${esc(o.sourceName)} — المادة ${o.articleNumber} (${o.matchType}): «${esc(o.evidence)}»`);
  }
  if (ctx.candPhrases.length) {
    rec.push(`\n## عبارات مركّبة مرشّحة من كامل المتون (للمراجعة — خارج المعجم)`);
    for (const [p, c] of ctx.candPhrases.slice(0, 30)) rec.push(`- \`${esc(p)}\` — ${c} ورود`);
  }
  fs.writeFileSync(path.join(outDir, "concept-recurrence-report.md"), rec.join("\n") + "\n");
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
