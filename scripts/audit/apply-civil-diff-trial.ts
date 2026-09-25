/**
 * apply-civil-diff-trial.ts — تجربة إصلاح مدنية مشروطة (قراءة/كتابة على فرع اختبار فقط).
 *
 * الافتراضي: dry-run داخل معاملة ثم ROLLBACK.
 * للكتابة على فرع اختبار صراحةً:
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED \
 *   CONFIRM_CIVIL_TRIAL_BRANCH=hakeem-legal-repair-test-2026-09-22 \
 *   npx tsx scripts/audit/apply-civil-diff-trial.ts --apply-test
 *
 * ممنوع على الإنتاج: يتطلب أن يحتوي DATABASE_URL على اسم فرع الاختبار أو تأكيدًا صريحًا.
 * لا يطبّق إلا الصفوف ذات status=REVIEW_REQUIRED من ملف الفروق، وبشرط تطابق id + محتوى قديم.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

type DiffRow = {
  id: string;
  articleNumber: number | string;
  oldTitle: string;
  newTitle: string;
  oldContent: string;
  newContent: string;
  oldContentSha256: string;
  sourceContentSha256: string;
  status: string;
  productionApplied?: boolean | string;
};

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function assertGates(applyTest: boolean) {
  if (!process.env.DATABASE_URL) {
    console.error("✗ لا DATABASE_URL");
    process.exit(2);
  }
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ يلزم CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED");
    process.exit(2);
  }
  if (applyTest) {
    const branch = process.env.CONFIRM_CIVIL_TRIAL_BRANCH || "";
    if (branch !== "hakeem-legal-repair-test-2026-09-22") {
      console.error("✗ للكتابة يلزم CONFIRM_CIVIL_TRIAL_BRANCH=hakeem-legal-repair-test-2026-09-22");
      process.exit(2);
    }
    const url = process.env.DATABASE_URL;
    // دفاع بسيط: ارفض عناوين الإنتاج المعروفة إن ظهرت صراحة في السلسلة
    if (/br-rapid-salad|ep-icy-rice/i.test(url) && !/br-polished-thunder|repair-test/i.test(url)) {
      console.error("✗ DATABASE_URL يبدو إنتاجيًا — ارفض الكتابة. استخدم فرع الاختبار.");
      process.exit(2);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const applyTest = args.includes("--apply-test");
  const diffPath =
    args.find((a) => a.startsWith("--diff="))?.slice("--diff=".length) ||
    "handoff/archives/live-audit/round6/civil-proposed-diff.json";
  const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const onlyNums = only
    ? only.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
    : [237, 465, 468, 474, 720];

  assertGates(applyTest);

  const all = JSON.parse(readFileSync(diffPath, "utf8")) as DiffRow[];
  const batch = all.filter((r) => onlyNums.includes(Number(r.articleNumber)));
  if (!batch.length) {
    console.error("✗ لا صفوف في الدفعة");
    process.exit(1);
  }

  console.log(`دفعة: ${batch.length} صفًا | applyTest=${applyTest} | افتراضي ROLLBACK`);

  const results: Array<Record<string, unknown>> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of batch) {
      if (row.status !== "REVIEW_REQUIRED") {
        results.push({ id: row.id, skipped: true, reason: "status_not_review_required" });
        continue;
      }
      const current = await tx.legalArticle.findUnique({
        where: { id: row.id },
        select: { id: true, articleNumber: true, title: true, content: true },
      });
      if (!current) {
        results.push({ id: row.id, ok: false, reason: "missing_row" });
        continue;
      }
      const currentSha = sha(current.content);
      if (currentSha !== row.oldContentSha256) {
        results.push({
          id: row.id,
          ok: false,
          reason: "optimistic_lock_failed",
          expectedOld: row.oldContentSha256,
          actual: currentSha,
        });
        continue;
      }
      if (Number(current.articleNumber) !== Number(row.articleNumber)) {
        results.push({ id: row.id, ok: false, reason: "article_number_mismatch" });
        continue;
      }

      const updated = await tx.legalArticle.update({
        where: { id: row.id },
        data: { title: row.newTitle, content: row.newContent },
        select: { id: true, articleNumber: true, title: true, content: true },
      });
      results.push({
        id: row.id,
        ok: true,
        articleNumber: updated.articleNumber,
        newSha: sha(updated.content),
        expectedSourceSha: row.sourceContentSha256,
        sourceMatch: sha(updated.content) === row.sourceContentSha256,
      });
    }

    if (!applyTest) {
      // فرض التراجع حتى لو نجح التحديث داخل المعاملة
      throw new Error("DRY_RUN_ROLLBACK");
    }
  }).catch((e) => {
    if (e instanceof Error && e.message === "DRY_RUN_ROLLBACK") {
      console.log("✓ dry-run: نُفذت التحديثات داخل المعاملة ثم ROLLBACK");
      return;
    }
    throw e;
  });

  console.log(JSON.stringify({ applyTest, results }, null, 2));
  const failed = results.filter((r) => r.ok === false);
  if (failed.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
