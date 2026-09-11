/**
 * export-saudi-systems.ts — تصدير الأنظمة وموادها إلى data/saudi_systems.json
 * ──────────────────────────────────────────────────────────────────
 * المصدر: قاعدة البيانات (Neon) **حصراً** في الوضع الافتراضي.
 *
 * ⚠️ تاريخياً كان هذا السكربت يسقط بصمت إلى فهرس BM25 ثم إلى ملف البذرة عند
 * تعذّر الاتصال بالقاعدة، بتحذير console.warn فقط. وهذا ما أنتج الملف الحالي
 * من الفهرس لا من القاعدة، فضاعت العناوين الترتيبية الرسمية التي كانت الدليل
 * الوحيد الكاشف لانزياح مواد نظام المعاملات المدنية (٢٣٧–٧٢٠).
 * انظر: reports/legal-data-audit-2026-09-11/08-root-cause-analysis.md
 *
 * الآن: يفشل السكربت بوضوح بدل أن يتدهور صامتاً.
 *   --allow-degraded : يسمح بالاشتقاق من فهرس BM25 (نصّ مقتطع وبلا عناوين).
 *   --allow-seed     : يسمح بالاشتقاق من ملف البذرة (جزئي — ٩ أنظمة فقط).
 *   --force          : يتجاوز حارس الانكماش (انظر assertNoShrink).
 *
 * المخرج: data/saudi_systems.json (meta + توصيف السكيمة + الأنظمة مع موادها ومجالها المُصنَّف).
 *
 * التشغيل: npm run export:saudi-systems
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import {
  classifyDomain,
  SYSTEMS_SCHEMA,
  type SaudiArticle,
  type SaudiSystem,
  type SaudiSystemsExport
} from "@/lib/modules/legal-core/saudi-systems";

const DATA = join(process.cwd(), "data");

type RawArticle = {
  article_number?: number;
  articleNumber?: number;
  law_name?: string;
  lawName?: string;
  title?: string;
  content?: string;
  chapter?: string | null;
  classification?: string | null;
  status?: string | null;
  keywords?: string[];
};

function toArticle(r: RawArticle): { lawName: string; art: SaudiArticle } {
  const lawName = (r.law_name ?? r.lawName ?? "(بدون اسم)").trim();
  return {
    lawName,
    art: {
      articleNumber: Number(r.article_number ?? r.articleNumber ?? 0),
      title: (r.title ?? "").trim(),
      content: (r.content ?? "").trim(),
      chapter: r.chapter ?? null,
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      classification: r.classification ?? null,
      status: (r.status ?? "سارية").trim()
    }
  };
}

function aggregate(rows: RawArticle[], extraClass?: Map<string, string | null>): SaudiSystem[] {
  const byName = new Map<string, SaudiSystem>();
  for (const r of rows) {
    const { lawName, art } = toArticle(r);
    let sys = byName.get(lawName);
    if (!sys) {
      const domain = classifyDomain(lawName);
      sys = {
        name: lawName,
        domain: domain.slug,
        domainTitle: domain.title,
        classification: extraClass?.get(lawName) ?? null,
        articleCount: 0,
        articles: []
      };
      byName.set(lawName, sys);
    }
    sys.articles.push(art);
  }
  for (const sys of byName.values()) {
    sys.articles.sort((a, b) => a.articleNumber - b.articleNumber);
    sys.articleCount = sys.articles.length;
  }
  return [...byName.values()].sort((a, b) => b.articleCount - a.articleCount);
}

async function fromDatabase(): Promise<SaudiSystem[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const articles = await prisma.legalArticle.findMany({
      select: {
        lawName: true,
        articleNumber: true,
        title: true,
        content: true,
        chapter: true,
        classification: true,
        status: true,
        keywords: true
      }
    });
    const systems = await prisma.legalSystem.findMany({ select: { name: true, classification: true } });
    const classMap = new Map(systems.map((s) => [s.name, s.classification]));
    await prisma.$disconnect().catch(() => undefined);
    return aggregate(articles as RawArticle[], classMap);
  } catch (e) {
    console.warn("⚠️  تعذّر القراءة من قاعدة البيانات، سأشتقّ من ملف التصدير:", (e as Error).message);
    return null;
  }
}

/**
 * فهرس BM25 يحوي meta لكامل الكوربوس (كل المواد/الأنظمة) مع law_name + article_number + snippet.
 * هو أكمل مصدر متاح دون قاعدة بيانات (نصّ المادة = snippet مقتطع، بلا chapter).
 */
function fromBm25Index(): { systems: SaudiSystem[]; source: string } | null {
  const path = join(DATA, "legal-bm25-index.json.gz");
  if (!existsSync(path)) return null;
  try {
    const idx = JSON.parse(gunzipSync(readFileSync(path)).toString("utf-8")) as {
      meta?: Record<string, { law_name?: string; article_number?: number; snippet?: string; citation?: string }>;
    };
    const meta = idx.meta;
    if (!meta || typeof meta !== "object") return null;
    const rows: RawArticle[] = [];
    for (const code of Object.keys(meta)) {
      const m = meta[code];
      if (!m?.law_name) continue;
      rows.push({
        law_name: m.law_name,
        article_number: m.article_number,
        // ⚠️ لا يُشتقّ العنوان من الرقم أبداً: اشتقاقه يجعل فحص «هل يطابق العنوان
        // الرقم؟» دائرياً وناجحاً دوماً بحكم البناء، فيُخفي أي انزياح.
        // الفهرس لا يحفظ العنوان الترتيبي ⇒ يُترك فارغاً ويُعلَّم في meta.
        title: "",
        content: m.snippet ?? "",
        keywords: []
      });
    }
    if (!rows.length) return null;
    return { systems: aggregate(rows), source: "data/legal-bm25-index.json.gz (meta — الكوربوس الكامل)" };
  } catch (e) {
    console.warn("⚠️  تعذّرت قراءة فهرس BM25:", (e as Error).message);
    return null;
  }
}

function fromArticlesFile(): { systems: SaudiSystem[]; source: string } {
  const path = join(DATA, "legal_articles_export.json");
  const rows = JSON.parse(readFileSync(path, "utf-8")) as RawArticle[];
  return { systems: aggregate(rows), source: "data/legal_articles_export.json (جزئي)" };
}

/**
 * حارس الانكماش: يرفض الكتابة إذا كان الناتج أصغر جوهرياً من الملف القائم.
 * بدونه، تشغيلة واحدة من مصدر ناقص تمحو الكوربوس (١٥٬٩٠٢ ← ١٬٩٨١ مثلاً)
 * دون أن ينتبه أحد، لأن الملف يُكتب فوق السابق.
 */
function assertNoShrink(newArticles: number, newSystems: number): void {
  const outPath = join(DATA, "saudi_systems.json");
  if (!existsSync(outPath)) return;
  let prev: { meta?: { articlesCount?: number; systemsCount?: number } };
  try {
    prev = JSON.parse(readFileSync(outPath, "utf-8"));
  } catch {
    return; // ملف قائم غير صالح — لا مرجع للمقارنة
  }
  const prevArticles = prev.meta?.articlesCount ?? 0;
  const prevSystems = prev.meta?.systemsCount ?? 0;
  if (!prevArticles) return;

  const ratio = newArticles / prevArticles;
  if (ratio >= 0.9) return;

  if (process.argv.includes("--force")) {
    console.warn(`⚠️  انكماش مقبول بـ--force: ${prevArticles} ← ${newArticles} مادة.`);
    return;
  }
  console.error("");
  console.error("❌ رُفضت الكتابة: الناتج أصغر جوهرياً من الملف القائم.");
  console.error(`   الأنظمة: ${prevSystems} ← ${newSystems}`);
  console.error(`   المواد : ${prevArticles} ← ${newArticles}  (${Math.round(ratio * 100)}%)`);
  console.error("   هذا نمط فقدان بيانات لا تحديث. راجع المصدر قبل المتابعة.");
  console.error("   إن كان الانكماش مقصوداً فمرّر --force.");
  process.exit(1);
}

async function main() {
  console.log("📤 تصدير الأنظمة وموادها → data/saudi_systems.json");
  console.log("=".repeat(56));

  const allowDegraded = process.argv.includes("--allow-degraded");
  const allowSeed = process.argv.includes("--allow-seed");

  let systems = await fromDatabase();
  let source = "database (legal_systems + legal_articles)";

  if (!systems) {
    if (!allowDegraded && !allowSeed) {
      console.error("");
      console.error("❌ تعذّرت القراءة من قاعدة البيانات، ولن أتدهور بصمت.");
      console.error("   المصدر المعتمد الوحيد هو Neon. أصلح DATABASE_URL وأعد المحاولة.");
      console.error("");
      console.error("   إن كنت تقصد التوليد من مصدر ناقص عمداً، مرّر راية صريحة:");
      console.error("     --allow-degraded  → من فهرس BM25 (نصّ مقتطع، بلا عناوين ترتيبية)");
      console.error("     --allow-seed      → من ملف البذرة (٩ أنظمة فقط — ناقص جداً)");
      process.exit(1);
    }
    const f = (allowDegraded ? fromBm25Index() : null) ?? (allowSeed ? fromArticlesFile() : null);
    if (!f) {
      console.error("❌ تعذّر أيضاً قراءة المصدر البديل المسموح به. لم يُكتب شيء.");
      process.exit(1);
    }
    systems = f.systems;
    source = f.source;
    console.warn("");
    console.warn("⚠️ ".repeat(18));
    console.warn("⚠️  تحذير: التوليد من مصدر متدهور، لا من قاعدة البيانات.");
    console.warn(`⚠️  المصدر: ${source}`);
    console.warn("⚠️  الناتج غير صالح للتدقيق ولا لإعادة بناء الفهارس.");
    console.warn("⚠️ ".repeat(18));
    console.warn("");
  }

  assertNoShrink(systems.reduce((n, s) => n + s.articleCount, 0), systems.length);
  const contentIsSnippet = source.includes("bm25");

  const articlesCount = systems.reduce((n, s) => n + s.articleCount, 0);
  const out: SaudiSystemsExport = {
    meta: {
      generatedAt: new Date().toISOString(),
      source,
      systemsCount: systems.length,
      articlesCount,
      note:
        "مُولّد آلياً عبر export-saudi-systems.ts — domain مُصنَّف من اسم النظام (classifyDomain)." +
        (contentIsSnippet ? " نصّ المادة = snippet مقتطع من فهرس BM25 (بلا chapter)؛ يُستكمل من قاعدة البيانات." : "")
    },
    schema: SYSTEMS_SCHEMA,
    systems
  };

  const outPath = join(DATA, "saudi_systems.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`   المصدر: ${source}`);
  console.log(`   الأنظمة: ${systems.length} · المواد: ${articlesCount}`);
  console.log("   المجالات المُصنَّفة:");
  const byDomain = new Map<string, number>();
  for (const s of systems) byDomain.set(s.domainTitle, (byDomain.get(s.domainTitle) ?? 0) + 1);
  for (const [d, c] of [...byDomain].sort((a, b) => b[1] - a[1])) console.log(`     • ${d}: ${c} نظام`);
  console.log(`✅ كُتب: data/saudi_systems.json`);
}

main().catch((e) => {
  console.error("❌ خطأ:", e);
  process.exitCode = 1;
});
