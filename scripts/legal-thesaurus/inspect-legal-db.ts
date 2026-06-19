/**
 * inspect-legal-db.ts — المرحلة الأولى من المكنز القانوني: فحص قاعدة البيانات الحالية
 * (قراءة فقط، بلا أي تعديل/حذف/إنشاء). يُخرج تقرير بنية شاملاً لجداول الأنظمة والمواد.
 *
 * يجيب على: الجداول، حقول النظام/المادة، الأعداد، الأنظمة الأعلى مواد، مواد التعريفات،
 * المواد الفارغة/القصيرة، المواد المكررة، وتغطية الحقول. لا يلمس أي بيانات.
 *
 * التشغيل: npm run thesaurus:inspect   (يتطلّب DATABASE_URL/NEON_DATABASE_URL — قراءة فقط)
 */
import { prisma } from "@/lib/prisma";

const SHORT_LEN = 40; // مادة «قصيرة جداً» إن قلّ نصّها عن هذا
const DEFINITION_PATTERNS = [
  "يقصد بالكلمات والعبارات",
  "يقصد بـ",
  "يقصد به",
  "لأغراض هذا النظام",
  "لأغراض تطبيق",
  "المعاني المبينة أمام كل منها",
  "المعاني الموضحة",
  "ما لم يقتض السياق",
  "يدل اللفظ",
  "التعريفات",
  "المصطلحات",
];

type Json = Record<string, unknown>;

async function q<T = Json>(sql: string): Promise<T[]> {
  try {
    return (await prisma.$queryRawUnsafe<T[]>(sql)) ?? [];
  } catch (e) {
    console.log("  ⚠ تعذّر استعلام:", e instanceof Error ? e.message.split("\n")[0].slice(0, 120) : e);
    return [];
  }
}

async function main() {
  const report: Json = { phase: "1-inspection (read-only)", inspectedAt: new Date().toISOString() };
  console.log("🔎 فحص قاعدة بيانات الأنظمة (المرحلة الأولى — قراءة فقط)");
  console.log("=".repeat(64));

  // بصمة الهدف (بلا أسرار)
  const host = (() => { try { return new URL(process.env.DATABASE_URL || "").hostname; } catch { return "unknown"; } })();
  console.log(`الهدف: ${host}`);
  report.targetHost = host;

  // 1) جداول public
  const tables = await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  report.publicTables = tables.map((t) => t.table_name);
  console.log(`\n① جداول public: ${tables.length}`);

  // 2) حقول جدولي الأنظمة والمواد
  for (const tbl of ["legal_systems", "legal_articles"]) {
    const cols = await q<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' ORDER BY ordinal_position`
    );
    (report as Json)[`columns_${tbl}`] = cols;
    console.log(`\n② حقول ${tbl}: ${cols.map((c) => c.column_name).join(", ")}`);
  }

  // 3) الأعداد
  const systems = await prisma.legalSystem.count().catch(() => 0);
  const articles = await prisma.legalArticle.count().catch(() => 0);
  const distinctLawNames = (await q<{ c: bigint }>(`SELECT count(DISTINCT "lawName")::bigint AS c FROM legal_articles`))[0]?.c ?? 0;
  report.counts = { legalSystems: systems, legalArticles: articles, distinctLawNames: Number(distinctLawNames) };
  console.log(`\n③ الأعداد: أنظمة=${systems} · مواد=${articles} · أسماء أنظمة متمايزة=${Number(distinctLawNames)}`);

  // 4) الأنظمة الأعلى مواد
  const top = await q<{ lawName: string; c: bigint }>(
    `SELECT "lawName", count(*)::bigint AS c FROM legal_articles GROUP BY "lawName" ORDER BY c DESC LIMIT 15`
  );
  report.topSystems = top.map((r) => ({ lawName: r.lawName, articles: Number(r.c) }));
  console.log("\n④ أعلى 15 نظاماً بعدد المواد:");
  top.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(Number(r.c)).padStart(4)} | ${r.lawName.slice(0, 60)}`));

  // 5) مواد التعريفات الصريحة
  const orClause = DEFINITION_PATTERNS.map((p) => `"content" ILIKE '%${p.replace(/'/g, "''")}%' OR "title" ILIKE '%${p.replace(/'/g, "''")}%'`).join(" OR ");
  const defCount = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE ${orClause}`))[0]?.c ?? 0;
  const defByPattern: Json = {};
  for (const p of DEFINITION_PATTERNS) {
    const c = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE "content" ILIKE '%${p.replace(/'/g, "''")}%' OR "title" ILIKE '%${p.replace(/'/g, "''")}%'`))[0]?.c ?? 0;
    defByPattern[p] = Number(c);
  }
  report.definitionArticles = { total: Number(defCount), byPattern: defByPattern };
  console.log(`\n⑤ مواد تحتوي تعريفات صريحة: ${Number(defCount)}`);
  Object.entries(defByPattern).forEach(([p, c]) => console.log(`   - «${p}»: ${c}`));

  // 6) المواد الفارغة/القصيرة جداً
  const emptyC = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE "content" IS NULL OR length(btrim("content")) = 0`))[0]?.c ?? 0;
  const shortC = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE length(btrim("content")) BETWEEN 1 AND ${SHORT_LEN}`))[0]?.c ?? 0;
  report.shortOrEmpty = { empty: Number(emptyC), shortUnder: SHORT_LEN, short: Number(shortC) };
  console.log(`\n⑥ مواد فارغة=${Number(emptyC)} · مواد قصيرة (<${SHORT_LEN} حرف)=${Number(shortC)}`);

  // 7) المواد المكررة (تطابق نصّي تام عبر md5)
  const dupGroups = await q<{ h: string; c: bigint }>(
    `SELECT md5("content") AS h, count(*)::bigint AS c FROM legal_articles WHERE length(btrim("content"))>0 GROUP BY md5("content") HAVING count(*)>1 ORDER BY c DESC LIMIT 10`
  );
  const dupTotal = (await q<{ c: bigint }>(
    `SELECT COALESCE(sum(c-1),0)::bigint AS c FROM (SELECT count(*) c FROM legal_articles WHERE length(btrim("content"))>0 GROUP BY md5("content") HAVING count(*)>1) t`
  ))[0]?.c ?? 0;
  report.duplicates = { redundantArticles: Number(dupTotal), topGroups: dupGroups.map((g) => ({ count: Number(g.c) })) };
  console.log(`\n⑦ مواد مكررة (نصّ متطابق تام): ${Number(dupTotal)} مادة زائدة في ${dupGroups.length}+ مجموعة`);

  // 8) تغطية الحقول
  const withChapter = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE "chapter" IS NOT NULL AND btrim("chapter")<>''`))[0]?.c ?? 0;
  const withClass = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE "classification" IS NOT NULL AND btrim("classification")<>''`))[0]?.c ?? 0;
  const withKeywords = (await q<{ c: bigint }>(`SELECT count(*)::bigint AS c FROM legal_articles WHERE array_length("keywords",1) > 0`))[0]?.c ?? 0;
  const statusDist = await q<{ status: string; c: bigint }>(`SELECT "status", count(*)::bigint AS c FROM legal_articles GROUP BY "status" ORDER BY c DESC LIMIT 10`);
  report.fieldCoverage = {
    chapter: Number(withChapter), classification: Number(withClass), keywords: Number(withKeywords),
    statusDistribution: statusDist.map((s) => ({ status: s.status, c: Number(s.c) })),
  };
  console.log(`\n⑧ تغطية الحقول: باب/فصل=${Number(withChapter)} · تصنيف=${Number(withClass)} · كلمات مفتاحية=${Number(withKeywords)}`);
  console.log("   توزيع الحالة:", statusDist.map((s) => `${s.status}=${Number(s.c)}`).join(" · "));

  // 9) خريطة الحقول لمشروع المكنز (مع الناقص)
  report.fieldMappingForThesaurus = {
    systemName: "legal_articles.lawName (+ legal_systems.name عبر legalSystemId)",
    articleNumber: "legal_articles.articleNumber",
    text: "legal_articles.content (+ title)",
    chapterSection: "legal_articles.chapter (حقل واحد — لا فصل باب/فصل منفصلين)",
    status: "legal_articles.status",
    issueDate: "legal_articles.effectiveFrom / royalDecree",
    sourceUrl: "غير موجود (لا حقل رابط مصدر على المادة) ⚠",
  };

  console.log("\n" + "=".repeat(64));
  console.log("📄 تقرير JSON الكامل:");
  console.log(JSON.stringify(report, null, 2));
  console.log("\n✅ انتهى الفحص (لم تُكتب أي بيانات).");
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
