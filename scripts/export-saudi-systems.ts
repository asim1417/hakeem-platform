/**
 * export-saudi-systems.ts — تصدير الأنظمة وموادها إلى data/saudi_systems.json
 * ──────────────────────────────────────────────────────────────────
 * المصدر:
 *   • إن توفّر DATABASE_URL → قراءة legal_systems + legal_articles عبر Prisma (المصدر الأدق).
 *   • وإلا → اشتقاق الأنظمة من data/legal_articles_export.json (تجميع حسب law_name).
 *
 * المخرج: data/saudi_systems.json (meta + توصيف السكيمة + الأنظمة مع موادها ومجالها المُصنَّف).
 *
 * التشغيل: npm run export:saudi-systems
 */
import { readFileSync, writeFileSync } from "node:fs";
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

function fromFile(): { systems: SaudiSystem[]; source: string } {
  const path = join(DATA, "legal_articles_export.json");
  const rows = JSON.parse(readFileSync(path, "utf-8")) as RawArticle[];
  return { systems: aggregate(rows), source: "data/legal_articles_export.json" };
}

async function main() {
  console.log("📤 تصدير الأنظمة وموادها → data/saudi_systems.json");
  console.log("=".repeat(56));

  let systems = await fromDatabase();
  let source = "database (legal_systems + legal_articles)";
  if (!systems) {
    const f = fromFile();
    systems = f.systems;
    source = f.source;
  }

  const articlesCount = systems.reduce((n, s) => n + s.articleCount, 0);
  const out: SaudiSystemsExport = {
    meta: {
      generatedAt: new Date().toISOString(),
      source,
      systemsCount: systems.length,
      articlesCount,
      note: "مُولّد آلياً عبر export-saudi-systems.ts — domain مُصنَّف من اسم النظام (انظر classifyDomain)."
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
