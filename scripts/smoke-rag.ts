/**
 * smoke-rag.ts — فحص دخان قرائي للاسترجاع الهجين (لا كتابة، لا AI، لا أسرار).
 * يشغّل استعلامات تمثيلية عبر hybridSearch ويطبع: عدد النتائج + حالة المزوّدات +
 * عناوين أعلى النتائج. الهدف: إثبات أنّ طبقة الاسترجاع تُرجع مصادر على بيانات حقيقية.
 *
 * التشغيل (قراءة فقط): npm run smoke:rag
 */
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";

const QUERIES = ["الغبن", "فسخ العقد", "هل يجوز فسخ العقد بسبب الغبن", "نفقة الزوجة"];

async function main() {
  console.log("🔎 RAG retrieval smoke (read-only)");
  console.log("=".repeat(56));
  let anyResults = false;

  for (const q of QUERIES) {
    try {
      const r = await hybridSearch({ q, limit: 8 });
      const providers = r.providers.map((p) => `${p.name}:${p.status}`).join(", ");
      console.log(`\nالاستعلام: «${q}»`);
      console.log(`  النتائج: ${r.total} | المزوّدات: ${providers}`);
      r.results.slice(0, 3).forEach((m, i) =>
        console.log(`   ${i + 1}. [${m.type}] ${m.title.slice(0, 80)} (ثقة ${(m.confidence * 100).toFixed(0)}%، ${(m.meta?.matchedBy as string) ?? "—"})`)
      );
      if (r.total > 0) anyResults = true;
    } catch (e) {
      console.log(`\nالاستعلام: «${q}» — خطأ: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
  }

  console.log("\n" + "=".repeat(56));
  console.log(anyResults ? "✅ الاسترجاع يُرجع مصادر — الكود سليم على هذه القاعدة." : "❌ صفر نتائج لكل الاستعلامات — تحقّق من محتوى القاعدة.");
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
