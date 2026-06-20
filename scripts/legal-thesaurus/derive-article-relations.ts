/**
 * derive-article-relations.ts — اشتقاق «مواد ذات صلة» من المفاهيم المشتركة (حتمي، مُسنَد).
 *
 * مادتان مرتبطتان إذا تشاركتا مفاهيم مكنز **مُميِّزة** (غير محورية). يُكتب الرابط في
 * legal_relations (article → article, RELATED_TO) بقوّة = عدد المفاهيم المشتركة.
 * مُعلَّم description='auto:shared-concepts' فهو **عَوْدي** (يحذف صفوفه ثم يعيد).
 * يقصر على المفاهيم المعتمدة غير المحورية (تردّد 2..السقف) كي لا تُربط كل المواد ببعضها.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const exec = (sql: string, ...a: unknown[]) => prisma.$executeRawUnsafe(sql, ...a);
const query = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);

/** سقف تردّد المفهوم: المحوري (يرد في مواد كثيرة) يربط كل شيء — يُتجاهل. */
const MAX_CONCEPT_DF = 25;
/** تجاهل المفهوم الذي يظهر في عدد مواد أكبر من هذا ضمن العيّنة (حماية إضافية). */
const MAX_CLIQUE = 40;
/** أقصى عدد «مواد ذات صلة» تُحفظ لكل مادة (الأقوى تشاركاً). */
const TOP_K = 10;
const MARKER = "auto:shared-concepts";

async function insertRelations(rows: unknown[][], enumType: string): Promise<void> {
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    let p = 0;
    const tuples = chunk.map((r) =>
      "(" + r.map((v, idx) => { params.push(v); const ph = `$${++p}`; return idx === 5 ? `${ph}::"${enumType}"` : ph; }).join(",") + ")"
    );
    await exec(
      `INSERT INTO legal_relations (id,source_type,source_id,target_type,target_id,relation,strength,description) VALUES ${tuples.join(",")}`,
      ...params
    );
  }
}

async function main() {
  // اسم نوع enum العلاقات في Postgres (متين ضد اختلاف التسمية)
  const et = await query<{ typname: string }>(
    `SELECT t.typname FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE e.enumlabel='RELATED_TO' LIMIT 1`
  );
  const enumType = et[0]?.typname;
  if (!enumType) { console.error("✗ تعذّر إيجاد نوع enum يحوي RELATED_TO."); process.exit(1); }

  // مواضع المفاهيم المعتمدة المُميِّزة (تردّد 2..السقف)
  const occ = await query<{ concept_id: string; article_id: string }>(
    `SELECT o.concept_id, o.article_id
       FROM legal_thesaurus_occurrences o
       JOIN legal_thesaurus_concepts c ON c.id=o.concept_id
      WHERE c.status='approved' AND o.article_id IS NOT NULL
        AND coalesce(c.distinct_articles_count,0) BETWEEN 2 AND ${MAX_CONCEPT_DF}`
  );
  const byConcept = new Map<string, Set<string>>();
  for (const o of occ) {
    const s = byConcept.get(o.concept_id) ?? new Set<string>();
    s.add(o.article_id);
    byConcept.set(o.concept_id, s);
  }

  // عدّ المفاهيم المشتركة لكل زوج مواد
  const pair = new Map<string, number>();
  for (const arts of byConcept.values()) {
    const ids = [...arts];
    if (ids.length < 2 || ids.length > MAX_CLIQUE) continue;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        const key = `${a}|${b}`;
        pair.set(key, (pair.get(key) ?? 0) + 1);
      }
  }
  console.log(`📚 مواضع مُميِّزة: ${occ.length} · أزواج مشتركة: ${pair.size}`);

  // جوار لكل مادة، ثم أقوى TOP_K
  const adj = new Map<string, Array<{ o: string; n: number }>>();
  const push = (a: string, o: string, n: number) => {
    const arr = adj.get(a) ?? [];
    arr.push({ o, n });
    adj.set(a, arr);
  };
  for (const [key, n] of pair) {
    const [a, b] = key.split("|");
    push(a, b, n);
    push(b, a, n);
  }

  const deleted = await exec(`DELETE FROM legal_relations WHERE description='${MARKER}'`);
  console.log(`🧹 حُذفت روابط مُشتقّة سابقة: ${deleted}`);

  const rows: unknown[][] = [];
  for (const [a, list] of adj) {
    list.sort((x, y) => y.n - x.n);
    for (const { o, n } of list.slice(0, TOP_K)) {
      rows.push([randomUUID(), "article", a, "article", o, "RELATED_TO", n, MARKER]);
    }
  }
  await insertRelations(rows, enumType);
  console.log(`\n✅ كُتبت ${rows.length} علاقة مادة↔مادة · مواد لها ≥1 صلة: ${adj.size}`);
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
