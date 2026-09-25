/**
 * اختبار مسار بحث الأحكام المستقل (البند 1.7). قراءة فقط على Neon.
 * التشغيل: DATABASE_URL=<Neon> npx tsx scripts/test-rulings-search.ts [outDir]
 *
 * يخرج تقريرًا: لكل استعلام مرجعيّ العدد وزمن الاستجابة وأعلى صلة، + فحوص PDPL
 * وكلمة كاملة (لا احتواء) والفلاتر، ثم قائمة ما بقي غير متحقق.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { searchRulingsDirect, redactPII, extractHijriYear } from "../lib/modules/legal-core/rulings-search";

const OUT = process.argv[2] || "reports/legal-source-integrity";
const QUERIES = ["عقد الإيجار", "فسخ العقد", "الغبن", "الشيك", "التعويض", "الحضانة", "النفقة", "التحكيم", "الشفعة", "نجش"];
const PII_RE = /(?<!\d)[12][0-9]{9}(?!\d)/; // هوية/إقامة 10 خانات

async function main() {
  const prisma = new PrismaClient();
  let failed = 0;
  const ok = (c: boolean, m: string) => { if (!c) { failed++; console.error("✗ " + m); } else console.log("✓ " + m); };
  const rows: Array<Record<string, unknown>> = [];
  try {
    // وحدات (بلا قاعدة)
    ok(redactPII("رقم الهوية 1012345678 والجوال 0501234567").indexOf("1012345678") === -1, "PDPL: حجب رقم الهوية");
    ok(redactPII("جواله 0501234567").includes("[جوال محجوب]"), "PDPL: حجب الجوال");
    ok(extractHijriYear("في 12/3/1445هـ") === 1445, "استخراج السنة الهجرية");
    ok(extractHijriYear("١٢/٣/١٤٤٠") === 1440, "استخراج السنة من أرقام هندية");

    for (const q of QUERIES) {
      const { hits, total, ms } = await searchRulingsDirect({ query: q, limit: 5 });
      const top = hits[0];
      // فحص الكلمة الكاملة: أعلى نتيجة يجب أن تطابق كل ألفاظ الاستعلام ككلمات كاملة (score≈1).
      const wholeWord = !top || top.score >= 0.9;
      // فحص PDPL على المقتطفات.
      const leak = hits.some((h) => PII_RE.test(h.snippet));
      rows.push({ query: q, total, returned: hits.length, ms, topScore: top?.score ?? 0, sample: top?.snippet?.slice(0, 60) ?? "" });
      console.log(`  «${q}» → total=${total} ms=${ms} top=${top?.score?.toFixed(2) ?? "-"} ${leak ? "⚠PII" : ""}`);
      ok(!leak, `PDPL: لا تسريب هوية في نتائج «${q}»`);
      ok(wholeWord, `مطابقة كلمة كاملة في «${q}» (لا احتواء زائف)`);
    }

    // فحص مضادّ للإيجابيات الزائفة: «نجش» يجب ألّا يطابق «سونجشانج».
    const najsh = await searchRulingsDirect({ query: "نجش", limit: 3 });
    ok(najsh.hits.every((h) => h.score >= 0.9), "«نجش» نتائجه مطابقة كلمة كاملة (لا سونجشانج)");

    // فحص الفلتر: تقييد بسنة هجرية يُنقص أو يساوي الإجمالي غير المقيّد.
    const base = await searchRulingsDirect({ query: "التعويض", limit: 1 });
    const filtered = await searchRulingsDirect({ query: "التعويض", yearH: 1440, limit: 1 });
    ok(filtered.total <= base.total, "فلتر السنة الهجرية يُضيّق النتائج");

    const report = {
      generatedAt: new Date().toISOString(),
      source: "judicial_cases (Neon, read-only)",
      note: "بحث مستقلّ مباشر على الأحكام بلا دمج مواد/أنظمة. مطابقة كلمة كاملة (FTS simple) + تطبيع + حجب PDPL.",
      queries: rows,
      unresolved: [
        "لا يوجد عمود search_norm/فهرس GIN على الإنتاج — الأداء اعتمد على مسح تسلسليّ (الفهرس النهائي عبر هجرة على Neon branch لا الإنتاج).",
        "التاريخ الهجريّ يُستخرج من النصّ (لا عمود مبنيَن) — تغطية الاستخراج أقلّ من 100%.",
        "حجب PDPL تقريبيّ (هوية/جوال/آيبان)؛ أسماء الأفراد تحتاج سياسة منفصلة.",
      ],
    };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "rulings-search-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(`\n→ ${OUT}/rulings-search-report.json`);
    console.log(failed === 0 ? "✓ نجحت اختبارات بحث الأحكام" : `✗ فشل ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
