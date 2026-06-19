/**
 * extract-sample.ts — استخراج عيّنة عالية الثقة للمكنز: المصطلحات المُعرَّفة صراحةً
 * من مواد التعريفات فقط. يكتب في **جداول المكنز الجديدة فقط** (لا يمسّ الأصلية).
 *
 * المبادئ: سند نصّي لكل مفهوم · منع تكرار بالـ normalized_label · إحالة المشكوك
 * للمراجعة · قابلية الاستئناف (يتخطّى ما له snapshot) · بلا تخمين.
 *
 * الأداء: تحميل التسميات الموجودة مرة واحدة (لا SELECT لكل مصطلح) + إدخال دفعي
 * متعدّد الصفوف (bulk insert) — أسرع بكثير من الإدخال المتتابع.
 *
 * 🔒 لا يعمل إلا بـ: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeText, searchableText, splitSentences, splitParagraphs, textHash } from "@/lib/modules/legal-thesaurus/normalize";
import { isDefinitionArticle, extractDefinedTerms, classifyConceptType } from "@/lib/modules/legal-thesaurus/definitions";
import { scoreDefinedTerm, decideReview, conceptStatus } from "@/lib/modules/legal-thesaurus/scoring";

const exec = (sql: string, ...args: unknown[]) => prisma.$executeRawUnsafe(sql, ...args);
const query = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...args);

/** إدخال دفعي متعدّد الصفوف (بدون أعمدة jsonb). يقسّم إلى دفعات. */
async function bulkInsert(table: string, cols: string[], rows: unknown[][], conflict = ""): Promise<void> {
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    let p = 0;
    const tuples = chunk.map((r) => "(" + r.map((v) => { params.push(v); return `$${++p}`; }).join(",") + ")");
    await exec(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${tuples.join(",")} ${conflict}`, ...params);
  }
}

function assertConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ مقفول. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED.");
    process.exit(1);
  }
}

async function main() {
  assertConfirmed();
  const args = process.argv.slice(2);
  const limArg = args.indexOf("--limit");
  const limit = limArg >= 0 ? Math.max(1, Number(args[limArg + 1])) : 500;

  const tcheck = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!tcheck.length || Number(tcheck[0].c) === 0) { console.error("✗ جداول المكنز غير موجودة."); process.exit(1); }

  // إعادة ضبط اختيارية: تُفرّغ جداول محتوى المكنز الجديدة فقط (لا الأصلية ولا المجالات)
  // لإعادة قياس نظيفة بعد تحسين الاستخراج.
  if (args.includes("--reset")) {
    for (const t of ["legal_thesaurus_occurrences","legal_thesaurus_definitions","legal_thesaurus_terms","legal_thesaurus_candidate_terms","legal_thesaurus_review_queue","legal_thesaurus_concepts","legal_thesaurus_text_snapshots"]) {
      await exec(`TRUNCATE TABLE ${t} CASCADE`).catch(() => 0);
    }
    console.log("♻ أُفرغت جداول محتوى المكنز الجديدة (الأصلية والمجالات لم تُمسّ).");
  }

  const runId = randomUUID();
  await exec(`INSERT INTO legal_thesaurus_extraction_runs (id, run_type, status, source_scope, batch_size) VALUES ($1,'definitions_sample','running','definition_articles',$2)`, runId, limit);

  // تحميل التسميات الموجودة مرة واحدة (يلغي SELECT لكل مصطلح)
  const known = new Map<string, { id: string; def: string }>();
  for (const c of await query<{ id: string; normalized_label: string; definition_text: string | null }>(
    `SELECT id, normalized_label, definition_text FROM legal_thesaurus_concepts`
  ).catch(() => [])) {
    known.set(c.normalized_label, { id: c.id, def: c.definition_text ?? "" });
  }

  const defLike = "content ILIKE '%يقصد%' OR content ILIKE '%المعاني المبينة%' OR content ILIKE '%المعاني الموضحة%' OR content ILIKE '%لأغراض هذا النظام%' OR content ILIKE '%لأغراض تطبيق%' OR title ILIKE '%تعريف%' OR content ILIKE '%التعريفات%'";
  const rows = await query<{ id: string; lawName: string; legalSystemId: string | null; articleNumber: number; title: string; content: string; status: string }>(
    `SELECT a.id, a."lawName", a."legalSystemId", a."articleNumber", a.title, a.content, a.status
     FROM legal_articles a
     WHERE (${defLike}) AND NOT EXISTS (SELECT 1 FROM legal_thesaurus_text_snapshots s WHERE s.article_id = a.id)
     ORDER BY a.id ASC LIMIT ${limit}`
  );
  console.log(`📚 مواد تعريفات للمعالجة: ${rows.length} (حدّ=${limit})`);

  // مجمّعات الإدخال الدفعي
  const conceptRows: unknown[][] = [], defRows: unknown[][] = [], termRows: unknown[][] = [], candRows: unknown[][] = [], occRows: unknown[][] = [];
  let processed = 0, createdConcepts = 0, reviewItems = 0, skippedNonDef = 0;
  const conceptFreq = new Map<string, number>();

  for (const a of rows) {
    processed += 1;
    // snapshot (per-row بسبب jsonb) — مرة واحدة لكل مادة
    await exec(
      `INSERT INTO legal_thesaurus_text_snapshots (id, article_id, legal_source_id, original_text, normalized_text, searchable_text, sentences_json, paragraphs_json, text_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (article_id) DO NOTHING`,
      randomUUID(), a.id, a.legalSystemId, a.content, normalizeText(a.content), searchableText(a.content),
      JSON.stringify(splitSentences(a.content)), JSON.stringify(splitParagraphs(a.content)), textHash(a.content)
    ).catch(() => 0);

    if (!isDefinitionArticle(a.content, a.title)) { skippedNonDef += 1; continue; }

    for (const d of extractDefinedTerms(a.content)) {
      const normLabel = searchableText(d.term);
      if (!normLabel) continue;
      const score = scoreDefinedTerm({ definitionLength: d.definition.length, sourceStatus: a.status, termWordCount: d.term.split(/\s+/).length });
      const evidence = `${d.term}: ${d.definition}`.slice(0, 500);
      const existing = known.get(normLabel);

      if (existing) {
        // تعريف مختلف جوهرياً بين نظامين ⇒ مراجعة (لا دمج)
        if (existing.def && searchableText(existing.def).slice(0, 60) !== searchableText(d.definition).slice(0, 60)) {
          await exec(
            `INSERT INTO legal_thesaurus_review_queue (id, item_type, item_id, issue_type, proposed_action, evidence_json, status)
             VALUES ($1,'concept',$2,'definition_differs_across_systems','review_keep_separate',$3::jsonb,'pending')`,
            randomUUID(), existing.id, JSON.stringify({ lawName: a.lawName, articleNumber: a.articleNumber, newDefinition: d.definition.slice(0, 300) })
          ).catch(() => 0);
          reviewItems += 1;
        }
        occRows.push([randomUUID(), existing.id, a.id, a.legalSystemId, a.articleNumber, evidence, "definition"]);
      } else {
        const id = randomUUID();
        known.set(normLabel, { id, def: d.definition });
        const review = decideReview(score);
        const status = conceptStatus(score, review);
        conceptRows.push([id, d.term, normLabel, classifyConceptType(d.term, d.definition), "explicit_legal_definition", d.definition, score, `${a.lawName} — المادة ${a.articleNumber}`, status, review.needsReview]);
        defRows.push([randomUUID(), id, d.definition, "explicit_legal_definition", a.id, evidence, score, "candidate"]);
        termRows.push([randomUUID(), id, d.term, normLabel, "preferred", score, status]);
        candRows.push([randomUUID(), d.term, normLabel, d.term.length, "defined_term", a.id, a.legalSystemId, a.articleNumber, evidence, "explicit_definition", score, "approved_as_concept", runId]);
        occRows.push([id, id, a.id, a.legalSystemId, a.articleNumber, evidence, "definition"]);
        createdConcepts += 1;
        if (review.needsReview) reviewItems += 1;
      }
      conceptFreq.set(d.term, (conceptFreq.get(d.term) ?? 0) + 1);
    }
  }

  // إدخال دفعي
  await bulkInsert("legal_thesaurus_concepts", ["id","preferred_label_ar","normalized_label","concept_type","definition_type","definition_text","confidence_score","source_basis","status","needs_human_review"], conceptRows, "ON CONFLICT (normalized_label) DO NOTHING");
  await bulkInsert("legal_thesaurus_definitions", ["id","concept_id","definition_text","definition_type","source_article_id","evidence_quote","confidence_score","status"], defRows);
  await bulkInsert("legal_thesaurus_terms", ["id","concept_id","term_text","normalized_term","term_type","confidence_score","status"], termRows);
  await bulkInsert("legal_thesaurus_candidate_terms", ["id","term_text","normalized_term","term_length","term_type_candidate","source_article_id","legal_source_id","article_number","evidence_quote","extraction_method","confidence_score","status","run_id"], candRows);
  // occRows: قد يكون concept_id == term_id placeholder للمفاهيم الجديدة؛ نضبط term_id=null
  await bulkInsert("legal_thesaurus_occurrences", ["id","concept_id","article_id","legal_source_id","article_number","occurrence_text","occurrence_type"], occRows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]));

  await exec(`UPDATE legal_thesaurus_extraction_runs SET status='completed', finished_at=now(), total_articles=$2, processed_articles=$3, created_concepts=$4, created_terms=$5 WHERE id=$1`, runId, rows.length, processed, createdConcepts, termRows.length).catch(() => 0);

  const top = [...conceptFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  console.log("\n" + "=".repeat(60));
  console.log("📊 تقرير العيّنة (بعد التنقية)");
  console.log("=".repeat(60));
  console.log(`مواد معالَجة: ${processed} · ليست تعريفات فعلية: ${skippedNonDef}`);
  console.log(`مفاهيم جديدة: ${createdConcepts} · مواضع: ${occRows.length} · للمراجعة: ${reviewItems}`);
  console.log(`\nأكثر 50 مفهوماً وروداً:`);
  top.forEach(([t, c], i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(c).padStart(3)} | ${t.slice(0, 50)}`));
  console.log("\n✅ انتهت العيّنة (إدخال دفعي، جداول المكنز الجديدة فقط).");
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
