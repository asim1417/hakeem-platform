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
import { scanArticleForConcepts, scanCompoundCandidates, BODY_CONCEPT_LEXICON } from "@/lib/modules/legal-thesaurus/body-concepts";
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
}

function aggKey(label: string): string { return searchableText(label); }

async function main() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ مقفول. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED."); process.exit(1);
  }
  const wantSystem = arg("--system");
  const wantSystemId = arg("--system-id");
  const reset = process.argv.includes("--reset");
  const topCandidates = Number(arg("--top") ?? 40);

  const tcheck = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!tcheck.length || Number(tcheck[0].c) === 0) { console.error("✗ جداول المكنز غير موجودة (طبّق 001 ثم 002)."); process.exit(1); }
  // التحقق من أعمدة 002
  const colCheck = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.columns WHERE table_name='legal_thesaurus_concepts' AND column_name='recurrence_strength'`).catch(() => []);
  if (!colCheck.length || Number(colCheck[0].c) === 0) { console.error("✗ أعمدة 002 غير مطبّقة (recurrence_strength مفقود). طبّق 002-occurrence-recurrence.sql."); process.exit(1); }

  // ── اختيار نظام واحد طويل ──
  const groups = await query<{ law: string; n: number; sid: string | null }>(
    `SELECT a."lawName" AS law, count(*)::int AS n, min(a."legalSystemId") AS sid
     FROM legal_articles a WHERE a."lawName" IS NOT NULL GROUP BY a."lawName" ORDER BY n DESC`
  );
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
  if (!chosen) { console.error("✗ لا أنظمة."); process.exit(1); }
  console.log(`🎯 النظام المختار (الطيّار): «${chosen.law}» — ${chosen.n} مادة.`);

  const articles = await query<ArticleRow>(
    `SELECT id, "lawName", "legalSystemId", "articleNumber", title, content, status
     FROM legal_articles WHERE "lawName" = $1 ORDER BY "articleNumber" ASC NULLS LAST, id ASC`, chosen.law
  );
  const total = articles.length;
  if (!total) { console.error("✗ لا مواد للنظام."); process.exit(1); }

  if (reset) {
    for (const t of ["legal_thesaurus_occurrences","legal_thesaurus_definitions","legal_thesaurus_terms","legal_thesaurus_candidate_terms","legal_thesaurus_review_queue","legal_thesaurus_concepts","legal_thesaurus_text_snapshots"]) {
      await exec(`TRUNCATE TABLE ${t} CASCADE`).catch(() => 0);
    }
    console.log("♻ أُفرغت جداول محتوى المكنز الجديدة (الأصلية والمجالات لم تُمسّ).");
  }

  const runId = randomUUID();
  await exec(`INSERT INTO legal_thesaurus_extraction_runs (id, run_type, status, source_scope, batch_size, total_articles) VALUES ($1,'full_body_system_pilot','running',$2,$3,$4)`, runId, chosen.law.slice(0, 200), total, total);

  // ── المرور على كامل المتن ──
  const concepts = new Map<string, ConceptAgg>();
  const compoundFreq = new Map<string, number>();
  let defArticles = 0, bodyTouchedArticles = 0;

  const ensure = (label: string, type: string, domain: string | null, isCompound: boolean, carefulGroup?: string): ConceptAgg => {
    const k = aggKey(label);
    let c = concepts.get(k);
    if (!c) {
      c = { id: randomUUID(), label, normLabel: k, type, domain, carefulGroup, isCompound, hasDef: false, hasBody: false, defScore: 0, defText: "", defEvidence: "", defArticleId: null, occ: [], exactMatch: false };
      concepts.set(k, c);
    }
    return c;
  };

  for (let i = 0; i < total; i++) {
    const a = articles[i];
    const ratio = total > 1 ? i / (total - 1) : 0;
    const artNum = String(a.articleNumber ?? i + 1);

    // ① لقطة
    await exec(
      `INSERT INTO legal_thesaurus_text_snapshots (id, article_id, legal_source_id, original_text, normalized_text, searchable_text, sentences_json, paragraphs_json, text_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (article_id) DO NOTHING`,
      randomUUID(), a.id, a.legalSystemId, a.content, normalizeText(a.content), searchableText(a.content),
      JSON.stringify(splitSentences(a.content)), JSON.stringify(splitParagraphs(a.content)), textHash(a.content)
    ).catch(() => 0);

    // ② تعريفات صريحة
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

    // ③ مسح المتن بالمعجم
    let touched = false;
    for (const hit of scanArticleForConcepts(a.content)) {
      touched = true;
      const c = ensure(hit.entry.label, hit.entry.type, hit.entry.domain, hit.entry.isCompound, hit.entry.carefulGroup);
      c.hasBody = true;
      if (hit.matchType === "exact_label_match") c.exactMatch = true;
      c.occ.push({ articleId: a.id, sourceId: a.legalSystemId, sourceName: a.lawName, articleNumber: artNum, ratio, matchType: hit.matchType, evidence: hit.evidence, type: "body_usage", count: hit.count });
    }
    if (touched) bodyTouchedArticles += 1;

    // ④ عبارات مركّبة مرشّحة (من كامل المتن) للمراجعة
    for (const cand of scanCompoundCandidates(a.content)) compoundFreq.set(cand.phrase, (compoundFreq.get(cand.phrase) ?? 0) + cand.count);
  }

  // ── احتساب التكرار والموقع والكتابة ──
  const lexiconLabels = new Set(BODY_CONCEPT_LEXICON.map((e) => searchableText(e.label)));
  const conceptRows: Array<{ a: ConceptAgg; rec: RecurrenceStrength; pos: SourcePosition; scope: string; basis: string; score: number; needsReview: boolean; dist: Record<string, number>; firstId: string; strongId: string; firstRatio: number }> = [];
  const occRows: unknown[][] = [], defRows: unknown[][] = [], termRows: unknown[][] = [];

  for (const c of concepts.values()) {
    const distinctArticles = new Set(c.occ.map((o) => o.articleId)).size;
    const distinctSources = new Set(c.occ.map((o) => o.sourceId ?? c.label)).size;
    const totalOcc = c.occ.reduce((s, o) => s + o.count, 0);
    const ratios = c.occ.map((o) => o.ratio);
    const rec = classifyRecurrence({ totalOccurrences: totalOcc, distinctArticles, distinctSources });
    const pos = classifySourcePosition(ratios);
    const scope = classifyScope(c.hasDef, c.hasBody);
    const basis = c.hasDef && c.hasBody ? "mixed_definition_and_body" : c.hasDef ? "explicit_legal_definition" : "body_usage";
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
    conceptRows.push({ a: c, rec, pos, scope, basis, score, needsReview, dist, firstId, strongId, firstRatio });

    // مواضع
    for (const o of c.occ) {
      occRows.push([randomUUID(), c.id, o.articleId, o.sourceId, Number.isFinite(Number(o.articleNumber)) ? Number(o.articleNumber) : null, o.evidence, o.type, o.sourceName, o.matchType, score, o.ratio]);
    }
    // مصطلح مفضّل
    termRows.push([randomUUID(), c.id, c.label, c.normLabel, "preferred", score, needsReview ? "candidate" : "approved"]);
    // تعريف (إن وُجد)
    if (c.hasDef && c.defArticleId) defRows.push([randomUUID(), c.id, c.defText, "explicit_legal_definition", c.defArticleId, c.defEvidence, c.defScore, "candidate"]);
  }

  // إدخال المفاهيم (per-row بسبب jsonb)
  for (const r of conceptRows) {
    const c = r.a;
    await exec(
      `INSERT INTO legal_thesaurus_concepts
        (id, preferred_label_ar, normalized_label, concept_type, legal_domain_primary, definition_type, definition_text, confidence_score, source_basis, status, needs_human_review,
         extraction_scope, source_position, article_position_ratio, total_occurrences_count, distinct_articles_count, distinct_sources_count, first_occurrence_article_id, strongest_occurrence_article_id, occurrence_distribution_json, recurrence_strength)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21)
       ON CONFLICT (normalized_label) DO NOTHING`,
      c.id, c.label, c.normLabel, c.type, c.domain, c.hasDef ? "explicit_legal_definition" : "contextual_usage", c.hasDef ? c.defText : null,
      r.score, r.basis, r.needsReview ? "candidate" : "approved", r.needsReview,
      r.scope, r.pos, r.firstRatio,
      c.occ.reduce((s, o) => s + o.count, 0), new Set(c.occ.map((o) => o.articleId)).size, new Set(c.occ.map((o) => o.sourceId ?? c.label)).size,
      r.firstId, r.strongId, JSON.stringify(r.dist), r.rec
    ).catch((e) => { console.error("concept insert:", c.label, e instanceof Error ? e.message.split("\n")[0] : e); });
  }
  await bulkInsert("legal_thesaurus_occurrences", ["id","concept_id","article_id","legal_source_id","article_number","occurrence_text","occurrence_type","legal_source_name","match_type","confidence_score","article_position_ratio"], occRows);
  await bulkInsert("legal_thesaurus_terms", ["id","concept_id","term_text","normalized_term","term_type","confidence_score","status"], termRows);
  await bulkInsert("legal_thesaurus_definitions", ["id","concept_id","definition_text","definition_type","source_article_id","evidence_quote","confidence_score","status"], defRows);

  // عبارات مركّبة مرشّحة (للمراجعة فقط) — خارج المعجم
  const candPhrases = [...compoundFreq.entries()].filter(([p]) => !lexiconLabels.has(searchableText(p))).sort((a, b) => b[1] - a[1]).slice(0, topCandidates);
  const candRows: unknown[][] = [], reviewRows: unknown[][] = [];
  for (const [phrase, count] of candPhrases) {
    const cid = randomUUID();
    candRows.push([cid, phrase, searchableText(phrase), phrase.length, "compound_body_phrase", null, chosen.sid, null, phrase.slice(0, 200), "body_compound_pattern", 0, "auto_candidate", runId]);
    reviewRows.push([randomUUID(), "candidate_term", cid, "compound_phrase_needs_classification", "review_classify_or_reject", JSON.stringify({ phrase, count, system: chosen.law }), "pending"]);
  }
  await bulkInsert("legal_thesaurus_candidate_terms", ["id","term_text","normalized_term","term_length","term_type_candidate","source_article_id","legal_source_id","article_number","evidence_quote","extraction_method","confidence_score","status","run_id"], candRows);
  for (const r of reviewRows) {
    await exec(`INSERT INTO legal_thesaurus_review_queue (id, item_type, item_id, issue_type, proposed_action, evidence_json, status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`, ...r).catch(() => 0);
  }

  await exec(`UPDATE legal_thesaurus_extraction_runs SET status='completed', finished_at=now(), processed_articles=$2, created_concepts=$3, created_terms=$4 WHERE id=$1`, runId, total, conceptRows.length, termRows.length).catch(() => 0);

  // ── التقارير ──
  writeReports({ system: chosen.law, total, defArticles, bodyTouchedArticles, articles, conceptRows, candPhrases });

  console.log("\n" + "=".repeat(64));
  console.log(`📊 الطيّار: «${chosen.law}» — ${total} مادة`);
  console.log(`مواد تعريفات: ${defArticles} · مواد مسّها المتن: ${bodyTouchedArticles} (${((bodyTouchedArticles / total) * 100).toFixed(1)}%)`);
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

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
