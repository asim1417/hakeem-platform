/**
 * اختبار البحث القانوني الهجين.
 * يتحقق من: عمل البحث بدون OpenSearch، ومعه إن توفّرت متغيرات البيئة،
 * وعدم رمي الأخطاء (عدم كسر API)، وثبات بنية النتيجة.
 *
 * التشغيل (محلي/تطوير): npm run test:hybrid — يتطلّب DATABASE_URL.
 */
import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";

async function main() {
  console.log("🧪 اختبار البحث الهجين");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;
  const check = (cond: boolean, label: string) => {
    console.log(`  ${cond ? "✅" : "❌"} ${label}`);
    cond ? passed++ : failed++;
  };

  const hasOpenSearch = Boolean((process.env.OPENSEARCH_URL || "").trim());
  console.log(`  OpenSearch مضبوط: ${hasOpenSearch ? "نعم" : "لا"}\n`);

  try {
    const res = await hybridSearch({ q: "نظام", limit: 10 });

    check(Array.isArray(res.results), "البحث يُرجع مصفوفة نتائج (لم يُكسَر)");
    check(Array.isArray(res.providers) && res.providers.length > 0, "حالة المزوّدات موجودة");

    const postgres = res.providers.find((p) => p.name === "postgres");
    check(postgres?.status === "active", "مزوّد PostgreSQL متاح (البحث يعمل بدونه أيضاً مضمون)");

    const opensearch = res.providers.find((p) => p.name === "opensearch");
    if (hasOpenSearch) {
      check(Boolean(opensearch), "مزوّد OpenSearch ظاهر في الحالة");
      console.log(`     حالة OpenSearch: ${opensearch?.status}`);
    } else {
      check(opensearch?.status === "unavailable", "OpenSearch غير متاح (بلا متغيرات) ولم يكسر البحث");
    }

    // بنية كل نتيجة
    const structureOk = res.results.every(
      (r) => r.type && r.id && typeof r.confidence === "number" && Array.isArray(r.sources) && Array.isArray(r.reasons)
    );
    check(structureOk, "كل نتيجة تحمل: النوع/المعرّف/الثقة/المصادر/الأسباب");

    console.log(`\n  الوضع: ${res.mode} · نتائج: ${res.total}`);
    console.log("  المزوّدات:", res.providers.map((p) => `${p.name}=${p.status}`).join(", "));
    for (const r of res.results.slice(0, 3)) {
      console.log(`    [${r.type}] ${r.title.slice(0, 60)} — ثقة ${(r.confidence * 100).toFixed(0)}% — مصادر: ${r.sources.join("+")}`);
    }
  } catch (e) {
    check(false, `البحث رمى استثناءً (يجب ألا يحدث): ${e instanceof Error ? e.message : e}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار البحث الهجين.");
}

main().catch((e) => {
  console.error("❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
