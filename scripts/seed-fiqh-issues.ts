/**
 * seed-fiqh-issues.ts — بذر المسائل الفقهية وروابطها بالمواد في قاعدة البيانات.
 * ──────────────────────────────────────────────────────────────────
 * المصدر: data/fiqh-nizam-links.json (ربط الموسوعة الفقهية بالأنظمة).
 * يملأ: fiqh_issues + fiqh_issue_links، ويحلّ article_id من legal_articles عبر (lawName, articleNumber).
 *
 * آمن: dry-run افتراضياً. للتطبيق: --apply
 * idempotent: يتخطّى المسائل الموجودة (بمطابقة id الثابت = issueId).
 * حوكمة: كل الصفوف status='candidate' و needs_human_review=true.
 *
 * التشغيل:
 *   npm run seed:fiqh                 # معاينة
 *   npm run seed:fiqh -- --apply      # تطبيق فعلي على DATABASE_URL
 */
import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");

type ArticleLink = { lawName: string; articleNumber: number; citation: string; score: number };
type MasalaLink = {
  issueId: string;
  title: string;
  path: string;
  nodeType: string;
  suggestedNizam: string;
  linkStatus: string;
  nizamRatio: number;
  articleLinks: ArticleLink[];
};

async function main() {
  console.log(`🌱 بذر المسائل الفقهية — الوضع: ${APPLY ? "تطبيق (--apply)" : "معاينة (dry-run)"}`);
  console.log("=".repeat(56));

  const data = JSON.parse(readFileSync(join(process.cwd(), "data", "fiqh-nizam-links.json"), "utf-8")) as {
    links: MasalaLink[];
  };
  // المسائل المقنّنة فقط (لها مواد): linked + needs_review
  const links = data.links.filter((l) => l.linkStatus === "linked" || l.linkStatus === "needs_review");
  console.log(`📖 مسائل قابلة للبذر (linked+needs_review): ${links.length} / ${data.links.length}`);

  // فهرس المواد للربط (lawName|articleNumber → id)
  const articles = await prisma.legalArticle
    .findMany({ select: { id: true, lawName: true, articleNumber: true } })
    .catch(() => [] as { id: string; lawName: string; articleNumber: number }[]);
  const artIndex = new Map(articles.map((a) => [`${a.lawName}|${a.articleNumber}`, a.id]));
  console.log(`🔗 مواد متاحة للربط: ${articles.length}`);

  const existing = APPLY
    ? new Set((await prisma.fiqhIssue.findMany({ select: { id: true } }).catch(() => [])).map((r) => r.id))
    : new Set<string>();

  let newIssues = 0;
  let newLinks = 0;
  let resolved = 0;

  for (const l of links) {
    if (existing.has(l.issueId)) continue;
    const section = l.path.split(" > ")[0] ?? "";
    const parts = l.path.split(" > ");
    const book = parts[1] ?? null;
    const chapter = parts[2] ?? null;

    const linkRows = l.articleLinks.map((a, rank) => {
      const articleId = artIndex.get(`${a.lawName}|${a.articleNumber}`) ?? null;
      if (articleId) resolved++;
      return {
        issueId: l.issueId,
        articleId,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        citation: a.citation,
        score: a.score,
        rank
      };
    });

    newIssues++;
    newLinks += linkRows.length;

    if (APPLY) {
      await prisma.fiqhIssue.create({
        data: {
          id: l.issueId,
          title: l.title,
          path: l.path,
          section,
          book,
          chapter,
          nodeType: l.nodeType,
          suggestedNizam: l.suggestedNizam,
          linkStatus: l.linkStatus,
          nizamRatio: l.nizamRatio,
          links: { create: linkRows.map(({ issueId: _i, ...r }) => r) }
        }
      });
    }
  }

  console.log("\n📊 الخطة:");
  console.log(`   مسائل جديدة:        ${newIssues}`);
  console.log(`   روابط مواد:         ${newLinks}`);
  console.log(`   روابط محلولة لمادة:  ${resolved} (${newLinks ? Math.round((resolved / newLinks) * 100) : 0}%)`);

  if (!APPLY) {
    console.log("\n⚠️  معاينة فقط — لم يُكتب شيء. أعِد التشغيل بـ --apply للتطبيق.");
    return;
  }
  console.log(`\n✅ تم: ${newIssues} مسألة · ${newLinks} رابطاً. كلها candidate/needs_human_review.`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
