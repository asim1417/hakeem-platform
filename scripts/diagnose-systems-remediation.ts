/**
 * diagnose-systems-remediation.ts — تشخيص المرحلة ١ (قراءة فقط، لا كتابة).
 *
 * يكشف الجذر الحقيقي لظهور/اختفاء الأنظمة:
 *  - عدد الأنظمة والمواد الفعلي في Neon.
 *  - المواد اليتيمة (legalSystemId = null) — السبب الرئيسي للاختفاء.
 *  - فروق ملف التصنيف ↔ القاعدة (أسماء في القاعدة لا في الملف والعكس).
 *  - قابلية ربط اليتيمة (lawName يطابق legal_systems.name؟).
 *  - فجوة فهرس BM25 إن توفّر.
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

function loadClassification(): { name: string; code: string }[] {
  try {
    const p = path.join(process.cwd(), "data", "legal_systems_classified.json");
    const j = JSON.parse(fs.readFileSync(p, "utf-8")) as { systems: { name: string; code: string }[] };
    return j.systems ?? [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);

  const [systemCount, articleCount, orphanCount] = await Promise.all([
    prisma.legalSystem.count().catch(() => -1),
    prisma.legalArticle.count().catch(() => -1),
    prisma.legalArticle.count({ where: { legalSystemId: null } }).catch(() => -1)
  ]);

  console.log("\n=== ① الأعداد الأساسية ===");
  console.log(`legal_systems = ${systemCount}`);
  console.log(`legal_articles = ${articleCount}`);
  console.log(`مواد يتيمة (legalSystemId = null) = ${orphanCount}  ${orphanCount > 0 ? "⚠️ سبب الاختفاء المحتمل" : "✓"}`);

  // أسماء الأنظمة في القاعدة
  const dbSystems = await prisma.legalSystem.findMany({ select: { name: true, code: true } }).catch(() => [] as { name: string; code: string | null }[]);
  const dbNames = new Set(dbSystems.map((s) => s.name.trim()));
  const codedCount = dbSystems.filter((s) => s.code).length;

  const cls = loadClassification();
  const fileNames = new Set(cls.map((s) => s.name.trim()));

  const inDbNotInFile = [...dbNames].filter((n) => !fileNames.has(n));
  const inFileNotInDb = [...fileNames].filter((n) => !dbNames.has(n));

  console.log("\n=== ② ملف التصنيف ↔ القاعدة ===");
  console.log(`أنظمة الملف = ${cls.length} | أنظمة القاعدة = ${dbNames.size} | مُرمّزة مسبقًا (code) = ${codedCount}`);
  console.log(`في القاعدة وليست في الملف = ${inDbNotInFile.length}`);
  inDbNotInFile.slice(0, 15).forEach((n) => console.log(`   • ${n}`));
  console.log(`في الملف وليست في القاعدة = ${inFileNotInDb.length}`);
  inFileNotInDb.slice(0, 15).forEach((n) => console.log(`   • ${n}`));

  // توزيع اليتيمة حسب lawName + قابلية الربط
  if (orphanCount > 0) {
    const orphanByLaw = await prisma.legalArticle
      .groupBy({ by: ["lawName"], where: { legalSystemId: null }, _count: { _all: true }, orderBy: { _count: { lawName: "desc" } } })
      .catch(() => [] as { lawName: string; _count: { _all: number } }[]);
    const relinkable = orphanByLaw.filter((o) => dbNames.has(o.lawName.trim()));
    const unrelinkable = orphanByLaw.filter((o) => !dbNames.has(o.lawName.trim()));
    const relinkableArticles = relinkable.reduce((s, o) => s + o._count._all, 0);

    console.log("\n=== ③ المواد اليتيمة: قابلية الربط ===");
    console.log(`أسماء أنظمة يتيمة قابلة للربط (lawName موجود في legal_systems) = ${relinkable.length} نظام / ${relinkableArticles} مادة`);
    console.log(`أسماء أنظمة يتيمة بلا نظام مطابق = ${unrelinkable.length}`);
    unrelinkable.slice(0, 20).forEach((o) => console.log(`   • ${o.lawName} (${o._count._all} مادة)`));
  }

  // فجوة BM25
  console.log("\n=== ④ فهرس BM25 ===");
  try {
    const p = path.join(process.cwd(), "data", "legal-bm25-index.json.gz");
    const raw = zlib.gunzipSync(fs.readFileSync(p)).toString("utf-8");
    const idx = JSON.parse(raw) as { docs?: unknown[]; documents?: unknown[]; systems?: unknown[] };
    const docs = (idx.docs ?? idx.documents ?? []).length;
    console.log(`مستندات الفهرس = ${docs} (القاعدة = ${articleCount}) ${docs && articleCount && docs < articleCount * 0.5 ? "⚠️ فجوة كبيرة — يحتاج إعادة بناء" : ""}`);
  } catch {
    console.log("تعذّر قراءة فهرس BM25 (قد يكون غائبًا أو بصيغة مختلفة).");
  }

  console.log("\n=== الخلاصة ===");
  console.log("لا كتابة في هذه المرحلة. راجع التقرير ثم أكّد قبل تطبيق التصنيف وربط اليتيمة.");
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
