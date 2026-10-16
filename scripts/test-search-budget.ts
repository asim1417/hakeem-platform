/** ميزانية مزوّد البحث: البطيء يُسقَط والسريع يُرجَع. التشغيل: npx tsx scripts/test-search-budget.ts */
import { withBudget } from "../lib/modules/legal-search/hybrid-search";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) { failed += 1; console.error("✗ " + m); } else console.log("✓ " + m);
};

async function main() {
  const fast = await withBudget(new Promise<number>((r) => setTimeout(() => r(1), 10)), 200);
  ok(fast === 1, "المزوّد السريع يُرجَع");
  const t0 = Date.now();
  const slow = await withBudget(new Promise<number>((r) => setTimeout(() => r(2), 2000)), 100);
  ok(typeof slow === "symbol" && Date.now() - t0 < 500, "المزوّد البطيء يُسقَط عند الميزانية");
  const late = await withBudget(new Promise<number>((_, j) => setTimeout(() => j(new Error("x")), 300)), 50);
  ok(typeof late === "symbol", "فشل متأخر بعد المهلة لا يرمي");
  await new Promise((r) => setTimeout(r, 400));
  if (failed) process.exit(1);
  console.log("\nكل الاختبارات نجحت");
}
main();
