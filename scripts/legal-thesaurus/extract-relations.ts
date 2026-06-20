/**
 * extract-relations.ts — اشتقاق علاقات المكنز وكتابتها في legal_thesaurus_relations.
 *
 * حتمي ومُسنَد، لا توليد:
 *   ① التضمين (broader/narrower): تضمين الرأس بين تسميات المفاهيم (lib/relations.ts).
 *   ② الترابط (related): تواضع المفاهيم في المواد نفسها (دليل = article_id مشترك).
 *
 * يكتب في جدول العلاقات فقط. مُعلَّم بـ explanation='auto:...' فهو **عَوْدي**: يحذف صفوفه
 * المُشتقّة سابقاً ثم يُعيد الإدراج (لا يمسّ علاقات مُدخَلة يدوياً). يقصر على المفاهيم المعتمدة.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deriveSubsumptionRelations, type ConceptLite } from "@/lib/modules/legal-thesaurus/relations";

const exec = (sql: string, ...a: unknown[]) => prisma.$executeRawUnsafe(sql, ...a);
const query = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);

/** أدنى عدد مواد مشتركة لاعتبار مفهومين «مترابطين». */
const MIN_COOCCUR = 2;
/** اعتماد related تلقائياً عند هذا التواضع أو أكثر؛ دونه يبقى candidate. */
const COOCCUR_APPROVE_AT = 3;
/** تجاهل المفاهيم المحورية العامة في الترابط (تتواضع مع كل شيء بلا تمييز). */
const MAX_DF_FOR_RELATED = 60;
/** سقف الترابطات لكل مفهوم (الأقوى تواضعاً) لتفادي الانفجار. */
const MAX_RELATED_PER_CONCEPT = 24;

async function bulkInsert(cols: string[], rows: unknown[][]): Promise<void> {
  const CHUNK = 80;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    let p = 0;
    const tuples = chunk.map((r) => "(" + r.map((v) => { params.push(v); return `$${++p}`; }).join(",") + ")");
    await exec(`INSERT INTO legal_thesaurus_relations (${cols.join(",")}) VALUES ${tuples.join(",")}`, ...params);
  }
}

async function main() {
  const exists = await query<{ c: bigint }>(
    `SELECT count(*)::bigint AS c FROM information_schema.tables WHERE table_name='legal_thesaurus_relations'`
  ).catch(() => []);
  if (!exists.length || Number(exists[0].c) === 0) {
    console.error("✗ جدول العلاقات غير موجود — طبّق المخطط أولاً.");
    process.exit(1);
  }

  // المفاهيم المعتمدة فقط (مع تردّدها لتمييز المحوري)
  const concepts = await query<{ id: string; label: string; df: number }>(
    `SELECT id, preferred_label_ar AS label, COALESCE(distinct_articles_count,0) AS df
       FROM legal_thesaurus_concepts WHERE status='approved'`
  );
  console.log(`📚 مفاهيم معتمدة: ${concepts.length}`);
  const dfById = new Map(concepts.map((c) => [c.id, Number(c.df)]));

  // حذف الصفوف المُشتقّة سابقاً (عَوْدية) — لا يمسّ المُدخَل يدوياً
  const deleted = await exec(`DELETE FROM legal_thesaurus_relations WHERE explanation LIKE 'auto:%'`);
  console.log(`🧹 حُذفت علاقات مُشتقّة سابقة: ${deleted}`);

  const cols = ["id", "source_concept_id", "target_concept_id", "relation_type", "confidence_score", "evidence_article_id", "evidence_quote", "explanation", "status"];
  const rows: unknown[][] = [];

  // ① التضمين (broader/narrower)
  const subs = deriveSubsumptionRelations(concepts as ConceptLite[]);
  for (const r of subs) {
    rows.push([randomUUID(), r.sourceId, r.targetId, r.type, r.confidence, null, null, "auto:subsumption", "approved"]);
  }
  console.log(`🔗 تضمين (broader/narrower): ${subs.length} صفّاً`);

  // ② الترابط (related) عبر التواضع في المواد
  const occ = await query<{ concept_id: string; article_id: string }>(
    `SELECT o.concept_id, o.article_id
       FROM legal_thesaurus_occurrences o
       JOIN legal_thesaurus_concepts c ON c.id=o.concept_id
      WHERE c.status='approved' AND o.article_id IS NOT NULL`
  );
  // مادة → مفاهيمها (المعتمدة غير المحورية)
  const byArticle = new Map<string, Set<string>>();
  for (const o of occ) {
    if ((dfById.get(o.concept_id) ?? 0) > MAX_DF_FOR_RELATED) continue;
    const s = byArticle.get(o.article_id) ?? new Set<string>();
    s.add(o.concept_id);
    byArticle.set(o.article_id, s);
  }
  // عدّ التواضع لكل زوج + مادة دليل
  const pairCount = new Map<string, { a: string; b: string; n: number; ev: string }>();
  for (const [articleId, set] of byArticle) {
    const ids = [...set];
    if (ids.length < 2 || ids.length > 20) continue; // تجاهل المواد المكتظّة (تفادي الانفجار)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        const key = `${a}|${b}`;
        const cur = pairCount.get(key);
        if (cur) cur.n += 1;
        else pairCount.set(key, { a, b, n: 1, ev: articleId });
      }
    }
  }
  // ترشيح بالعتبة + سقف لكل مفهوم
  const perConcept = new Map<string, number>();
  let relatedRows = 0;
  const strong = [...pairCount.values()].filter((p) => p.n >= MIN_COOCCUR).sort((x, y) => y.n - x.n);
  for (const p of strong) {
    if ((perConcept.get(p.a) ?? 0) >= MAX_RELATED_PER_CONCEPT) continue;
    if ((perConcept.get(p.b) ?? 0) >= MAX_RELATED_PER_CONCEPT) continue;
    perConcept.set(p.a, (perConcept.get(p.a) ?? 0) + 1);
    perConcept.set(p.b, (perConcept.get(p.b) ?? 0) + 1);
    const conf = Math.min(95, 50 + p.n * 10);
    const status = p.n >= COOCCUR_APPROVE_AT ? "approved" : "candidate";
    const expl = `auto:cooccurrence(n=${p.n})`;
    rows.push([randomUUID(), p.a, p.b, "related", conf, p.ev, null, expl, status]);
    rows.push([randomUUID(), p.b, p.a, "related", conf, p.ev, null, expl, status]);
    relatedRows += 2;
  }
  console.log(`🔗 ترابط (related): ${relatedRows} صفّاً (من ${strong.length} زوجاً ≥${MIN_COOCCUR})`);

  await bulkInsert(cols, rows);
  console.log(`\n✅ كُتبت ${rows.length} علاقة في legal_thesaurus_relations.`);
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
