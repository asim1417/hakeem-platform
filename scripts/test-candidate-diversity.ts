/**
 * اختبار اختيار المرشّحين المتنوّع (selectDiverseCandidateIds) — نقيّ، بلا قاعدة.
 * يضمن كسر احتكار نظام واحد للمجموعة مع الإكمال من الفائض. التشغيل: npm run test:diversity
 */
import { selectDiverseCandidateIds } from "@/lib/modules/legal-core/legal-retrieval";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function rows(spec: Array<[string, number]>): Array<{ id: string; lawName: string }> {
  const out: Array<{ id: string; lawName: string }> = [];
  for (const [law, n] of spec) for (let i = 0; i < n; i += 1) out.push({ id: `${law}-${i}`, lawName: law });
  return out;
}

function main() {
  console.log("🧪 اختبار اختيار المرشّحين المتنوّع");
  console.log("=".repeat(56));

  // نظام مهيمن (200 مادة) + أنظمة أخرى: السقف يمنع الاحتكار فتظهر أنظمة أكثر.
  const input = rows([["A", 200], ["B", 10], ["C", 10], ["D", 10]]);
  const sel = selectDiverseCandidateIds(input, { perSystemCap: 50, target: 60 });
  const bySys = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ((m[id.split("-")[0]] = (m[id.split("-")[0]] ?? 0) + 1), m), {});
  const dist = bySys(sel);
  check(sel.length === 60, "يبلغ الهدف (60)");
  check((dist.A ?? 0) <= 50, "النظام المهيمن A مقيّد بالسقف (≤50)");
  check(Object.keys(dist).length >= 4, "تظهر أنظمة متعدّدة (A,B,C,D) لا نظام واحد");
  check((dist.B ?? 0) === 10 && (dist.C ?? 0) === 10, "الأنظمة الصغيرة تدخل بالكامل");

  // نظام واحد: يبلغ الهدف ما دام السقف ≥ الهدف (السقف 80 ≥ أقصى صفحة).
  const only = selectDiverseCandidateIds(rows([["X", 100]]), { perSystemCap: 80, target: 50 });
  check(only.length === 50, "نظام واحد: يبلغ الهدف (50) لأن السقف ≥ الهدف");
  // والسقف يحدّ النظام الواحد عند تجاوز الهدف للسقف.
  check(selectDiverseCandidateIds(rows([["X", 100]]), { perSystemCap: 80, target: 200 }).length === 80, "نظام واحد: محدود بالسقف (80) عند هدف أكبر");

  // حالات حدّية
  check(selectDiverseCandidateIds([], { perSystemCap: 10, target: 10 }).length === 0, "مدخل فارغ → []");
  check(selectDiverseCandidateIds(rows([["A", 5]]), { perSystemCap: 10, target: 100 }).length === 5, "أقل من الهدف → كل المتاح");
  check(new Set(sel).size === sel.length, "لا تكرار في المعرّفات");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار اختيار المرشّحين المتنوّع.");
}

main();
