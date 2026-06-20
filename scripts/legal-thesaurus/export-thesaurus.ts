/**
 * export-thesaurus.ts — تصدير المكنز للمراجعة البشرية (قراءة فقط، لا كتابة).
 * يُخرج إلى out/legal-thesaurus/:
 *   - concepts-review.csv     : ورقة مراجعة المفاهيم (مع عمود «قرار المراجع» فارغ).
 *   - review-queue.csv        : عناصر قائمة المراجعة.
 *   - thesaurus-export.json   : تصدير منظّم كامل (مفاهيم + مصطلحات + تعريفات).
 *   - thesaurus-skos.json     : صيغة شبيهة بـ SKOS (prefLabel/altLabels/relations).
 *
 * كل ملفات CSV بترميز UTF-8 مع BOM (لعرض العربية في Excel).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const query = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);

function csv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const head = headers.map(esc).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return "﻿" + head + "\n" + body + "\n"; // BOM لعرض العربية
}

async function main() {
  const outDir = path.join(process.cwd(), "out", "legal-thesaurus");
  fs.mkdirSync(outDir, { recursive: true });

  const exists = await query<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!exists.length || Number(exists[0].c) === 0) { console.error("✗ جداول المكنز غير موجودة."); process.exit(1); }

  // المفاهيم — مع عدّادات التكرار المخزّنة (الدقيقة)، لا عيّنة جدول المواضع
  const concepts = await query<Record<string, unknown>>(
    `SELECT c.id, c.preferred_label_ar, c.normalized_label, c.concept_type, c.legal_domain_primary,
            c.definition_type, c.confidence_score, c.status, c.needs_human_review, c.source_basis,
            c.extraction_scope, c.source_position, c.definition_text,
            c.total_occurrences_count AS occurrences, c.distinct_articles_count, c.distinct_sources_count,
            c.recurrence_strength
     FROM legal_thesaurus_concepts c
     ORDER BY c.total_occurrences_count DESC NULLS LAST, c.confidence_score DESC`
  );
  console.log(`📦 مفاهيم: ${concepts.length}`);

  // ورقة مراجعة المفاهيم
  const reviewRows = concepts.map((c) => ({
    المفهوم: c.preferred_label_ar,
    النوع: c.concept_type,
    المجال: c.legal_domain_primary,
    الثقة: c.confidence_score,
    الحالة: c.status,
    يحتاج_مراجعة: c.needs_human_review ? "نعم" : "لا",
    السند: c.source_basis,
    التعريف: c.definition_text,
    عدد_المواضع: c.occurrences,
    عدد_المواد: c.distinct_articles_count,
    عدد_الأنظمة: c.distinct_sources_count,
    "قرار_المراجع (اعتماد/رفض/تعديل/دمج/فصل)": "",
    ملاحظات: "",
    concept_id: c.id,
  }));
  fs.writeFileSync(path.join(outDir, "concepts-review.csv"), csv(reviewRows, [
    "المفهوم","النوع","المجال","الثقة","الحالة","يحتاج_مراجعة","السند","التعريف","عدد_المواضع","عدد_المواد","عدد_الأنظمة","قرار_المراجع (اعتماد/رفض/تعديل/دمج/فصل)","ملاحظات","concept_id",
  ]));

  // قائمة المراجعة
  const reviewQueue = await query<Record<string, unknown>>(
    `SELECT id, item_type, item_id, issue_type, proposed_action, evidence_json::text AS evidence, status, created_at FROM legal_thesaurus_review_queue ORDER BY created_at DESC`
  ).catch(() => []);
  fs.writeFileSync(path.join(outDir, "review-queue.csv"), csv(reviewQueue, ["id","item_type","item_id","issue_type","proposed_action","evidence","status","created_at"]));
  console.log(`📦 عناصر مراجعة: ${reviewQueue.length}`);

  // مصطلحات وتعريفات لكل مفهوم (للـJSON)
  const terms = await query<Record<string, unknown>>(`SELECT concept_id, term_text, term_type, confidence_score, status FROM legal_thesaurus_terms`).catch(() => []);
  const defs = await query<Record<string, unknown>>(`SELECT concept_id, definition_text, definition_type, evidence_quote, confidence_score FROM legal_thesaurus_definitions`).catch(() => []);
  const relations = await query<Record<string, unknown>>(`SELECT source_concept_id, target_concept_id, relation_type FROM legal_thesaurus_relations`).catch(() => []);
  const termsByC = new Map<string, Record<string, unknown>[]>();
  for (const t of terms) (termsByC.get(t.concept_id as string) ?? termsByC.set(t.concept_id as string, []).get(t.concept_id as string)!).push(t);
  const defsByC = new Map<string, Record<string, unknown>[]>();
  for (const d of defs) (defsByC.get(d.concept_id as string) ?? defsByC.set(d.concept_id as string, []).get(d.concept_id as string)!).push(d);

  // JSON منظّم
  const num = (v: unknown) => Number(v ?? 0);
  const full = concepts.map((c) => ({
    id: c.id, preferredLabel: c.preferred_label_ar, normalizedLabel: c.normalized_label,
    type: c.concept_type, domain: c.legal_domain_primary, definitionType: c.definition_type,
    confidence: c.confidence_score, status: c.status, needsReview: c.needs_human_review,
    sourceBasis: c.source_basis, extractionScope: c.extraction_scope, sourcePosition: c.source_position,
    definition: c.definition_text,
    recurrence: {
      totalOccurrences: num(c.occurrences),
      distinctArticles: num(c.distinct_articles_count),
      distinctSources: num(c.distinct_sources_count),
      strength: c.recurrence_strength,
    },
    terms: (termsByC.get(c.id as string) ?? []).map((t) => ({ text: t.term_text, type: t.term_type, confidence: t.confidence_score, status: t.status })),
    definitions: (defsByC.get(c.id as string) ?? []).map((d) => ({ text: d.definition_text, type: d.definition_type, evidence: d.evidence_quote, confidence: d.confidence_score })),
  }));
  const approved = full.filter((c) => c.status === "approved").length;
  fs.writeFileSync(path.join(outDir, "thesaurus-export.json"), JSON.stringify({ exportedAt: new Date().toISOString(), conceptCount: full.length, approvedCount: approved, needsReviewCount: full.length - approved, concepts: full }, null, 2));

  // SKOS-like
  const relBySrc = new Map<string, Record<string, unknown>[]>();
  for (const r of relations) (relBySrc.get(r.source_concept_id as string) ?? relBySrc.set(r.source_concept_id as string, []).get(r.source_concept_id as string)!).push(r);
  const skos = concepts.map((c) => {
    const rels = relBySrc.get(c.id as string) ?? [];
    return {
      "@id": `concept:${c.id}`,
      prefLabel: c.preferred_label_ar,
      altLabels: (termsByC.get(c.id as string) ?? []).filter((t) => t.term_type !== "preferred").map((t) => t.term_text),
      definition: c.definition_text,
      conceptType: c.concept_type,
      domain: c.legal_domain_primary,
      broader: rels.filter((r) => r.relation_type === "broader").map((r) => `concept:${r.target_concept_id}`),
      narrower: rels.filter((r) => r.relation_type === "narrower").map((r) => `concept:${r.target_concept_id}`),
      related: rels.filter((r) => r.relation_type === "related").map((r) => `concept:${r.target_concept_id}`),
    };
  });
  fs.writeFileSync(path.join(outDir, "thesaurus-skos.json"), JSON.stringify({ "@context": "https://www.w3.org/2004/02/skos/core#", concepts: skos }, null, 2));

  console.log(`\n✅ صُدّر إلى ${outDir}:`);
  console.log("   concepts-review.csv · review-queue.csv · thesaurus-export.json · thesaurus-skos.json");
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
