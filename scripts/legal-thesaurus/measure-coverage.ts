/**
 * measure-coverage.ts — قياس (قراءة فقط) لتغطية المكنز للمواد، لتقدير ما سيسقط من
 * عدّادات لوحة الجودة قبل أي كتابة:
 *   - إجمالي المواد، والمواد بلا كلمات مفتاحية (العدّاد الحالي).
 *   - المواد التي فيها ≥1 موضع مفهوم (= قابلة لاكتساب كلمات مفتاحية).
 *   - المواد بلا كلمات لكن فيها مفهوم (= ما سيسقط فعلاً من «بلا كلمات مفتاحية»).
 *   - المواد التي تشارك مفهوماً مع مادة أخرى (= قابلة لاكتساب «مواد ذات صلة»).
 * لا يكتب شيئاً.
 */
import { prisma } from "@/lib/prisma";

const q = <T = Record<string, unknown>>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql);
const n = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "—");

async function main() {
  const [total, noKeywords] = await Promise.all([
    prisma.legalArticle.count(),
    prisma.legalArticle.count({ where: { keywords: { isEmpty: true } } }),
  ]);

  const withOcc = n(
    (await q<{ c: number }>(`SELECT count(DISTINCT article_id)::int AS c FROM legal_thesaurus_occurrences WHERE article_id IS NOT NULL`))[0]?.c
  );
  const droppableKw = n(
    (
      await q<{ c: number }>(
        `SELECT count(*)::int AS c FROM legal_articles a
          WHERE coalesce(cardinality(a.keywords),0)=0
            AND EXISTS (SELECT 1 FROM legal_thesaurus_occurrences o WHERE o.article_id=a.id)`
      )
    )[0]?.c
  );
  const relationCoverable = n(
    (
      await q<{ c: number }>(
        `WITH df AS (
            SELECT concept_id, count(DISTINCT article_id) AS d
              FROM legal_thesaurus_occurrences WHERE article_id IS NOT NULL GROUP BY concept_id
         )
         SELECT count(DISTINCT o.article_id)::int AS c
           FROM legal_thesaurus_occurrences o
           JOIN df ON df.concept_id=o.concept_id
          WHERE o.article_id IS NOT NULL AND df.d >= 2`
      )
    )[0]?.c
  );

  console.log("📊 تغطية المكنز للمواد (قراءة فقط)");
  console.log("=".repeat(56));
  console.log(`إجمالي المواد:                         ${total}`);
  console.log(`بلا كلمات مفتاحية (العدّاد الحالي):     ${noKeywords}  (${pct(noKeywords, total)})`);
  console.log(`مواد فيها ≥1 مفهوم مكنز:                ${withOcc}  (${pct(withOcc, total)})`);
  console.log("-".repeat(56));
  console.log(`▶ سيسقط من «بلا كلمات مفتاحية»:         ${droppableKw}`);
  console.log(`  (مواد بلا كلمات + فيها مفهوم ⇒ تكتسب كلمات)`);
  console.log(`  المتبقّي بعد التعبئة:                  ${Math.max(0, noKeywords - droppableKw)}`);
  console.log("-".repeat(56));
  console.log(`▶ قابلة لاكتساب «مواد ذات صلة»:         ${relationCoverable}  (${pct(relationCoverable, total)})`);
  console.log(`  (تشارك مفهوماً مع مادة أخرى — أساس عمود «بلا علاقات»)`);
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
