/**
 * eval-known-item.ts — قياس «العنصر المعروف» (known-item retrieval) على مستوى المادة.
 *
 * منهجية معيارية (نظير مهامّ TREC known-item): نعيّن عيّنةً من مواد حقيقية، نُولّد لكلّ
 * مادة استعلاماً من **عنوانها**، ثم نقيس رتبة استرجاع **تلك المادة بعينها**. الهدف الذهبي
 * هو المادة المُشتقّ منها الاستعلام — فالقياس **غير دائري وبلا وسم يدوي**، ويقيس ما تعجز
 * المجموعة على مستوى النظام عن قياسه: تمييز الترتيب على مستوى المادة (يفتح قياس السلطة/reranking).
 *
 * المقاييس: articleHit@1/3/5/10 · articleMRR · (ثانوي) systemTop1 = هل أعلى نتيجة من نظام المادة؟
 *
 * العيّنة **حتمية** (بلا عشوائية): مسح خفيف مرتّب بالمعرّف ثم أخذ كل k-ة، مع استبعاد العناوين
 * العامّة/القصيرة (لا تصلح استعلام عنصر معروف). قراءة فقط. سقوط آمن لكلّ استعلام.
 *
 * التشغيل:  npm run eval:known-item            (تقرير)
 *           npm run eval:known-item -- --gate  (بوّابة: يفشل دون العتبة)
 *           متغيّرات: KI_SAMPLE=120  KI_LIMIT=10  KI_MIN_TITLE=10  KI_MIN_HIT5=0.7
 */
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { prisma } from "@/lib/prisma";

type LightArticle = { id: string; title: string | null; lawName: string; articleNumber: number };

// عنوان صالح كاستعلام عنصر معروف: طويل كفايةً، ليس مجرّد «المادة N» أو رقمًا أو فارغًا.
function usableTitle(title: string | null, minLen: number): title is string {
  if (!title) return false;
  const t = title.trim();
  if (t.length < minLen) return false;
  if (/^\s*(المادة|مادة)\b/.test(t)) return false; // «المادة الأولى» ونحوها: غير مميِّز
  if (/^[\d\s٠-٩().,-]+$/.test(t)) return false; // أرقام/ترقيم فقط
  return true;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

type Probe = {
  id: string;
  query: string;
  lawName: string;
  articleNumber: number;
  rank: number | null; // رتبة المادة الهدف (null إذا خارج أعلى limit)
  systemTop1: boolean; // هل أعلى نتيجة من نفس النظام؟
  errored: boolean;
};

async function probe(article: LightArticle, limit: number): Promise<Probe> {
  const base: Probe = {
    id: article.id,
    query: article.title ?? "",
    lawName: article.lawName,
    articleNumber: article.articleNumber,
    rank: null,
    systemTop1: false,
    errored: false,
  };
  try {
    const res = await searchLegalCore({
      query: article.title ?? "",
      searchType: "contains",
      page: 1,
      limit,
      includeSnippets: false,
      includeMatchedParagraphs: false,
      includeRelatedTerms: false,
      semantic: true,
    });
    const idx = res.results.findIndex((r) => r.articleId === article.id);
    base.rank = idx >= 0 ? idx + 1 : null;
    const top = res.results[0];
    if (top) {
      const a = normalizeArabicText(top.systemName || "");
      const b = normalizeArabicText(article.lawName || "");
      base.systemTop1 = a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
    }
  } catch (error) {
    base.errored = true;
    base.query = error instanceof Error ? error.message.slice(0, 60) : "خطأ";
  }
  return base;
}

async function main() {
  const sampleSize = Number(process.env.KI_SAMPLE || 120);
  const limit = Number(process.env.KI_LIMIT || 10);
  const minTitle = Number(process.env.KI_MIN_TITLE || 10);
  const gate = process.argv.includes("--gate");
  const minHit5 = Number(process.env.KI_MIN_HIT5 || 0.7);

  console.log("═".repeat(82));
  console.log(`قياس «العنصر المعروف» (known-item) على مستوى المادة   |   عيّنة=${sampleSize}   |   limit=${limit}`);
  console.log("═".repeat(82));

  // مسح خفيف مرتّب بالمعرّف (حتمي)، ثم انتقاء العناوين الصالحة، ثم أخذ كل k-ة لتوزيع العيّنة.
  let usable: LightArticle[];
  try {
    const rows = await prisma.legalArticle.findMany({
      orderBy: { id: "asc" },
      select: { id: true, title: true, lawName: true, articleNumber: true },
    });
    usable = rows.filter((r) => usableTitle(r.title, minTitle));
  } catch (error) {
    console.error("✗ تعذّر مسح المواد — غالبًا لا اتصال بقاعدة البيانات.");
    console.error("  شغّل عبر workflow «Eval Known-Item (read-only)» مع NEON_DATABASE_URL.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }

  if (!usable.length) {
    console.error("✗ لا مواد بعناوين صالحة للاستعلام.");
    process.exit(2);
  }

  // أخذ حتمي متباعد عبر الكوربوس (لا عشوائية): كل stride-ة، ونزيل تكرار العنوان.
  const stride = Math.max(1, Math.floor(usable.length / sampleSize));
  const seenTitles = new Set<string>();
  const sample: LightArticle[] = [];
  for (let i = 0; i < usable.length && sample.length < sampleSize; i += stride) {
    const a = usable[i];
    const key = normalizeArabicText(a.title ?? "");
    if (seenTitles.has(key)) continue; // عنوان مكرّر عبر أنظمة → عنصر معروف ملتبس، نتجاوزه
    seenTitles.add(key);
    sample.push(a);
  }
  console.log(`مواد بعناوين صالحة: ${usable.length.toLocaleString("en-US")} من الكوربوس · العيّنة الفعلية: ${sample.length} (stride=${stride})\n`);

  const probes: Probe[] = [];
  for (const a of sample) probes.push(await probe(a, limit));

  const ok = probes.filter((p) => !p.errored);
  const errored = probes.length - ok.length;
  if (!ok.length) {
    console.error("✗ كل الاستعلامات فشلت — لا اتصال بقاعدة البيانات على الأرجح.");
    process.exit(2);
  }

  const hitAt = (k: number) => mean(ok.map((p) => (p.rank && p.rank <= k ? 1 : 0)));
  const agg = {
    hit1: hitAt(1),
    hit3: hitAt(3),
    hit5: hitAt(5),
    hit10: hitAt(10),
    mrr: mean(ok.map((p) => (p.rank ? 1 / p.rank : 0))),
    systemTop1: mean(ok.map((p) => (p.systemTop1 ? 1 : 0))),
  };

  console.log("─".repeat(82));
  console.log("النتائج (rank = رتبة المادة الهدف نفسها؛ — = خارج أعلى " + limit + "):\n");
  console.log(["rank", "النظام", "الاستعلام (عنوان المادة)"].join("\t"));
  console.log("─".repeat(82));
  for (const p of probes.slice(0, 40)) {
    console.log([p.errored ? "⚠" : p.rank ?? "—", (p.lawName || "").slice(0, 22), (p.query || "").slice(0, 46)].join("\t"));
  }
  if (probes.length > 40) console.log(`… و${probes.length - 40} أخرى`);

  console.log("\n" + "═".repeat(82));
  console.log("قياس العنصر المعروف (article-level، بلا دائرية):");
  console.log(`  articleHit@1 = ${pct(agg.hit1)}   @3 = ${pct(agg.hit3)}   @5 = ${pct(agg.hit5)}   @10 = ${pct(agg.hit10)}`);
  console.log(`  articleMRR = ${agg.mrr.toFixed(3)}   |   systemTop1 (أعلى نتيجة من نظام المادة) = ${pct(agg.systemTop1)}`);
  console.log(`  عيّنة مُقيَّمة = ${ok.length}${errored ? ` · فشل ${errored}` : ""}`);

  const misses = ok.filter((p) => !p.rank || p.rank > 5);
  if (misses.length) {
    console.log("\n" + "─".repeat(82));
    console.log(`لم تظهر المادة الهدف ضمن أعلى 5 (${misses.length}):`);
    for (const m of misses.slice(0, 15)) {
      console.log(`  ✗ [${m.lawName.slice(0, 20)}] «${(m.query || "").slice(0, 52)}» — رتبة ${m.rank ?? "—"}`);
    }
    if (misses.length > 15) console.log(`  … و${misses.length - 15} أخرى`);
  }
  console.log("═".repeat(82));

  if (gate) {
    if (agg.hit5 < minHit5) {
      console.error(`\n✗ بوّابة فاشلة: articleHit@5 = ${pct(agg.hit5)} < ${pct(minHit5)}`);
      process.exit(1);
    }
    console.log(`\n✓ بوّابة ناجحة: articleHit@5 = ${pct(agg.hit5)} ≥ ${pct(minHit5)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("✗ خطأ غير متوقّع في eval-known-item:", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
});
