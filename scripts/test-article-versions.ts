/**
 * اختبار اختيار النسخة النافذة بتاريخ (selectVersionAt) — نقيّ، بلا قاعدة.
 * التشغيل: npm run test:versions
 */
import { selectVersionAt } from "@/lib/modules/legal-core/article-versions";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const d = (s: string) => new Date(s);

function main() {
  console.log("🧪 اختبار النسخ الزمنية للمادة");
  console.log("=".repeat(56));

  // ثلاث نسخ متتالية: قديمة [.. , 2010)، وسطى [2010, 2020)، حالية [2020, ..)
  const versions = [
    { versionText: "نص-حالي", effectiveFrom: d("2020-01-01"), effectiveTo: null },
    { versionText: "نص-وسط", effectiveFrom: d("2010-01-01"), effectiveTo: d("2020-01-01") },
    { versionText: "نص-قديم", effectiveFrom: null, effectiveTo: d("2010-01-01") }
  ];

  check(selectVersionAt(versions, d("2005-06-01"))?.versionText === "نص-قديم", "قبل 2010 → القديم (بلا بداية)");
  check(selectVersionAt(versions, d("2015-06-01"))?.versionText === "نص-وسط", "بين 2010 و2020 → الوسط");
  check(selectVersionAt(versions, d("2025-06-01"))?.versionText === "نص-حالي", "بعد 2020 → الحالي (بلا نهاية)");
  // حدّ المدى: effectiveTo حصري، effectiveFrom شامل.
  check(selectVersionAt(versions, d("2020-01-01"))?.versionText === "نص-حالي", "عند 2020-01-01 بالضبط → الحالي (from شامل)");
  check(selectVersionAt(versions, d("2010-01-01"))?.versionText === "نص-وسط", "عند 2010-01-01 بالضبط → الوسط (to حصري)");

  // نسخة واحدة حالية فقط (الحالة الشائعة بعد الاشتقاق).
  const single = [{ versionText: "وحيدة", effectiveFrom: null, effectiveTo: null }];
  check(selectVersionAt(single, d("1999-01-01"))?.versionText === "وحيدة", "نسخة وحيدة بلا حدود → تُرجَع لأي تاريخ");

  // لا نسخ → null
  check(selectVersionAt([], d("2020-01-01")) === null, "بلا نسخ → null");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار النسخ الزمنية.");
}

main();
