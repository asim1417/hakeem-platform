/**
 * fill-keywords.ts — يملأ keywords للمواد الفارغة من مفاهيم المكنز المعتمدة.
 *
 * لكل مادة حقل keywords فيها فارغ ولها مفاهيم مكنز معتمدة ترد فيها: تُكتب أهمّ
 * المفاهيم **تخصّصاً** (الأقل تردّداً = الأدلّ) ككلمات مفتاحية (حتى MAX_KEYWORDS).
 * - لا يمسّ المواد التي لها كلمات أصلاً (آمن، لا يطمس إدخالاً بشرياً).
 * - عَوْدي: إعادة التشغيل لا تُعيد ملء المملوءة (شرط الفراغ في الاختيار).
 * - يقصر على المفاهيم المعتمدة (status='approved') لجودة الكلمات (لا ضجيج المرشّحات).
 */
import { prisma } from "@/lib/prisma";

const query = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);

/** أقصى عدد كلمات مفتاحية تُكتب لكل مادة. */
const MAX_KEYWORDS = 8;

interface Row {
  article_id: string;
  label: string;
  df: number;
  conf: number;
}

async function main() {
  const before = await prisma.legalArticle.count({ where: { keywords: { isEmpty: true } } });
  console.log(`📊 مواد بلا كلمات مفتاحية (قبل): ${before}`);

  // مفاهيم معتمدة ترد في مواد فارغة الكلمات — متمايزة لكل (مادة، مفهوم)
  const rows = await query<Row>(
    `SELECT DISTINCT o.article_id AS article_id,
            c.preferred_label_ar AS label,
            COALESCE(c.distinct_articles_count, 1000000) AS df,
            COALESCE(c.confidence_score, 0) AS conf
       FROM legal_thesaurus_occurrences o
       JOIN legal_thesaurus_concepts c ON c.id = o.concept_id
       JOIN legal_articles a ON a.id = o.article_id
      WHERE c.status = 'approved'
        AND o.article_id IS NOT NULL
        AND COALESCE(cardinality(a.keywords), 0) = 0`
  );
  console.log(`📚 صفوف (مادة×مفهوم): ${rows.length}`);

  // تجميع لكل مادة، ترتيب بالأكثر تخصّصاً (df تصاعدي) ثم الثقة، وأخذ أعلى MAX_KEYWORDS
  const byArticle = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byArticle.get(r.article_id) ?? [];
    arr.push(r);
    byArticle.set(r.article_id, arr);
  }

  const updates: Array<{ id: string; keywords: string[] }> = [];
  for (const [id, list] of byArticle) {
    list.sort((x, y) => Number(x.df) - Number(y.df) || Number(y.conf) - Number(x.conf));
    const seen = new Set<string>();
    const keywords: string[] = [];
    for (const r of list) {
      const k = (r.label || "").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      keywords.push(k);
      if (keywords.length >= MAX_KEYWORDS) break;
    }
    if (keywords.length) updates.push({ id, keywords });
  }
  console.log(`✍️ مواد ستُملأ كلماتها: ${updates.length}`);

  let done = 0;
  for (const u of updates) {
    await prisma.legalArticle.update({ where: { id: u.id }, data: { keywords: u.keywords } }).catch(() => 0);
    if (++done % 100 === 0) console.log(`   …${done}/${updates.length}`);
  }

  const after = await prisma.legalArticle.count({ where: { keywords: { isEmpty: true } } });
  console.log(`\n✅ كُتبت كلمات لـ ${updates.length} مادة.`);
  console.log(`📊 مواد بلا كلمات مفتاحية: ${before} → ${after}  (المتبقّي بلا مفهوم معتمد).`);
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
