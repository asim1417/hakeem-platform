/**
 * extract-sample.ts — استخراج عيّنة عالية الثقة للمكنز: المصطلحات المُعرَّفة صراحةً
 * من مواد التعريفات فقط. يكتب في **جداول المكنز الجديدة فقط** (لا يمسّ الأصلية).
 *
 * المبادئ: سند نصّي (evidence) لكل مفهوم · منع التكرار بالـ normalized_label ·
 * إحالة المشكوك للمراجعة · قابلية الاستئناف (يتخطّى ما له snapshot) · بلا تخمين.
 *
 * 🔒 لا يعمل إلا بتأكيد: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 * التشغيل (عبر workflow): npx tsx scripts/legal-thesaurus/extract-sample.ts --limit 500
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeText, searchableText, splitSentences, splitParagraphs, textHash } from "@/lib/modules/legal-thesaurus/normalize";
import { isDefinitionArticle, extractDefinedTerms, classifyConceptType, matchedTriggers } from "@/lib/modules/legal-thesaurus/definitions";
import { scoreDefinedTerm, decideReview, conceptStatus } from "@/lib/modules/legal-thesaurus/scoring";

const exec = (sql: string, ...args: unknown[]) => prisma.$executeRawUnsafe(sql, ...args);
const query = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...args);

function assertConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ مقفول. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED للكتابة في جداول المكنز.");
    process.exit(1);
  }
}

async function main() {
  assertConfirmed();
  const args = process.argv.slice(2);
  const limArg = args.indexOf("--limit");
  const limit = limArg >= 0 ? Math.max(1, Number(args[limArg + 1])) : 500;

  // تأكد من وجود جداول المكنز
  const exists = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!exists.length || Number(exists[0].c) === 0) {
    console.error("✗ جداول المكنز غير موجودة. طبّق 001-thesaurus-schema.sql أولاً.");
    process.exit(1);
  }

  const runId = randomUUID();
  await exec(
    `INSERT INTO legal_thesaurus_extraction_runs (id, run_type, status, source_scope, batch_size, total_articles) VALUES ($1,'definitions_sample','running','definition_articles',$2,0)`,
    runId, limit
  );

  // مواد التعريفات (ترشيح أولي بأنماط الترويسة) — مع تخطّي المعالَجة (لها snapshot)
  const defLike = "content ILIKE '%يقصد%' OR content ILIKE '%المعاني المبينة%' OR content ILIKE '%المعاني الموضحة%' OR content ILIKE '%لأغراض هذا النظام%' OR content ILIKE '%لأغراض تطبيق%' OR title ILIKE '%تعريف%' OR content ILIKE '%التعريفات%'";
  const rows = await query<{ id: string; lawName: string; legalSystemId: string | null; articleNumber: number; title: string; content: string; status: string }>(
    `SELECT a.id, a."lawName", a."legalSystemId", a."articleNumber", a.title, a.content, a.status
     FROM legal_articles a
     WHERE (${defLike})
       AND NOT EXISTS (SELECT 1 FROM legal_thesaurus_text_snapshots s WHERE s.article_id = a.id)
     ORDER BY a.id ASC LIMIT ${limit}`
  );
  console.log(`📚 مواد تعريفات للمعالجة: ${rows.length} (حدّ=${limit})`);

  let processed = 0, createdConcepts = 0, createdTerms = 0, createdDefs = 0, createdOcc = 0, reviewItems = 0, skippedNonDef = 0;
  const conceptFreq = new Map<string, number>();

  for (const a of rows) {
    processed += 1;
    // snapshot (يمنع إعادة المعالجة)
    const norm = normalizeText(a.content);
    await exec(
      `INSERT INTO legal_thesaurus_text_snapshots (id, article_id, legal_source_id, original_text, normalized_text, searchable_text, sentences_json, paragraphs_json, text_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (article_id) DO NOTHING`,
      randomUUID(), a.id, a.legalSystemId, a.content, norm, searchableText(a.content),
      JSON.stringify(splitSentences(a.content)), JSON.stringify(splitParagraphs(a.content)), textHash(a.content)
    ).catch(() => 0);

    if (!isDefinitionArticle(a.content, a.title)) { skippedNonDef += 1; continue; }
    const defs = extractDefinedTerms(a.content);
    const trigger = matchedTriggers(a.content, a.title)[0] ?? "";

    for (const d of defs) {
      const normLabel = searchableText(d.term);
      if (!normLabel) continue;
      const score = scoreDefinedTerm({ definitionLength: d.definition.length, sourceStatus: a.status, termWordCount: d.term.split(/\s+/).length });

      const existing = await query<{ id: string; definition_text: string | null }>(
        `SELECT id, definition_text FROM legal_thesaurus_concepts WHERE normalized_label = $1 LIMIT 1`, normLabel
      ).catch(() => []);

      let conceptId: string;
      if (existing.length) {
        conceptId = existing[0].id;
        // تعريف مختلف جوهرياً بين نظامين ⇒ مراجعة (لا دمج/استبدال)
        const prev = (existing[0].definition_text ?? "").trim();
        if (prev && d.definition.trim() && searchableText(prev).slice(0, 60) !== searchableText(d.definition).slice(0, 60)) {
          await exec(
            `INSERT INTO legal_thesaurus_review_queue (id, item_type, item_id, issue_type, proposed_action, evidence_json, status)
             VALUES ($1,'concept',$2,'definition_differs_across_systems','review_keep_separate',$3::jsonb,'pending')`,
            randomUUID(), conceptId, JSON.stringify({ lawName: a.lawName, articleNumber: a.articleNumber, newDefinition: d.definition, evidenceQuote: d.definition.slice(0, 300) })
          ).catch(() => 0);
          reviewItems += 1;
        }
      } else {
        conceptId = randomUUID();
        const review = decideReview(score, { inferredDefinition: false });
        const status = conceptStatus(score, review);
        const ctype = classifyConceptType(d.term, d.definition);
        await exec(
          `INSERT INTO legal_thesaurus_concepts (id, preferred_label_ar, normalized_label, concept_type, definition_type, definition_text, confidence_score, source_basis, status, needs_human_review)
           VALUES ($1,$2,$3,$4,'explicit_legal_definition',$5,$6,$7,$8,$9)`,
          conceptId, d.term, normLabel, ctype, d.definition, score,
          `${a.lawName} — المادة ${a.articleNumber}`, status, review.needsReview
        );
        createdConcepts += 1;
        // التعريف
        await exec(
          `INSERT INTO legal_thesaurus_definitions (id, concept_id, definition_text, definition_type, source_article_id, evidence_quote, confidence_score, status)
           VALUES ($1,$2,$3,'explicit_legal_definition',$4,$5,$6,'candidate')`,
          randomUUID(), conceptId, d.definition, a.id, `${d.term}: ${d.definition}`.slice(0, 500), score
        ).catch(() => 0);
        createdDefs += 1;
        // المصطلح المفضّل
        await exec(
          `INSERT INTO legal_thesaurus_terms (id, concept_id, term_text, normalized_term, term_type, confidence_score, status)
           VALUES ($1,$2,$3,$4,'preferred',$5,$6)`,
          randomUUID(), conceptId, d.term, normLabel, score, status
        ).catch(() => 0);
        createdTerms += 1;
        // مرشّح (للأثر)
        await exec(
          `INSERT INTO legal_thesaurus_candidate_terms (id, term_text, normalized_term, term_length, term_type_candidate, source_article_id, legal_source_id, article_number, evidence_quote, extraction_method, confidence_score, status, run_id)
           VALUES ($1,$2,$3,$4,'defined_term',$5,$6,$7,$8,'explicit_definition',$9,'approved_as_concept',$10)`,
          randomUUID(), d.term, normLabel, d.term.length, a.id, a.legalSystemId, a.articleNumber, `${d.term}: ${d.definition}`.slice(0, 500), score, runId
        ).catch(() => 0);
        if (review.needsReview) reviewItems += 1;
      }

      // موضع الورود (سند) — دائماً
      await exec(
        `INSERT INTO legal_thesaurus_occurrences (id, concept_id, article_id, legal_source_id, article_number, occurrence_text, occurrence_type)
         VALUES ($1,$2,$3,$4,$5,$6,'definition')`,
        randomUUID(), conceptId, a.id, a.legalSystemId, a.articleNumber, `${d.term}: ${d.definition}`.slice(0, 500)
      ).catch(() => 0);
      createdOcc += 1;
      conceptFreq.set(d.term, (conceptFreq.get(d.term) ?? 0) + 1);
    }
  }

  await exec(
    `UPDATE legal_thesaurus_extraction_runs SET status='completed', finished_at=now(), total_articles=$2, processed_articles=$3, created_concepts=$4, created_terms=$5, created_relations=0 WHERE id=$1`,
    runId, rows.length, processed, createdConcepts, createdTerms
  ).catch(() => 0);

  // تقرير الدفعة
  const top = [...conceptFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  console.log("\n" + "=".repeat(60));
  console.log("📊 تقرير العيّنة");
  console.log("=".repeat(60));
  console.log(`مواد معالَجة: ${processed} · منها ليست تعريفات فعلية: ${skippedNonDef}`);
  console.log(`مفاهيم جديدة: ${createdConcepts} · تعريفات: ${createdDefs} · مصطلحات: ${createdTerms} · مواضع: ${createdOcc}`);
  console.log(`عناصر للمراجعة: ${reviewItems}`);
  console.log(`\nأكثر 50 مفهوماً وروداً:`);
  top.forEach(([t, c], i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(c).padStart(3)} | ${t.slice(0, 50)}`));
  console.log("\n✅ انتهت العيّنة (كتابة في جداول المكنز الجديدة فقط).");
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
