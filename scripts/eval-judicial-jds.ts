// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §29/§34 — مُقيّم بنك الحالات القضائيّة (نقيّ).
// يشغّل الواجهة الموحّدة على كلّ حالة ويؤكّد شروط النجاح القابلة للفحص النقيّ:
//   العدائيّة تُرصد (بوّاباتها المانعة)، والذهبيّة تجتاز (لا بوّابة مانعة).
//   npm run eval:jds
// ─────────────────────────────────────────────────────────────────────────────
import { planJudicialTask, reviewJudicialDraft, JUDICIAL_EVAL_CASES } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
const failures: string[] = [];

function main() {
  for (const c of JUDICIAL_EVAL_CASES) {
    const plan = planJudicialTask({
      taskId: c.id,
      role: c.role,
      courtTrack: c.courtTrack,
      documentFunction: c.documentFunction,
      litigationStage: c.litigationStage,
    });
    const review = reviewJudicialDraft(plan, c.draft);

    // شرط ①: مطابقة الجاهزيّة المتوقّعة (عدائيّة=غير جاهزة، ذهبيّة=جاهزة).
    const readyOk = review.ready === c.expectReady;
    // شرط ②: الحالات العدائيّة تُرصد بالبوّابات المانعة المتوقّعة.
    const blockingOk = (c.expectBlocking ?? []).every((g) => review.blocking.includes(g));

    if (readyOk && blockingOk) {
      pass += 1;
      console.log(`✓ ${c.id} — ${c.titleAr}`);
    } else {
      fail += 1;
      const why = [
        readyOk ? "" : `ready=${review.ready} متوقّع=${c.expectReady}`,
        blockingOk ? "" : `مانعة=[${review.blocking.join(",")}] تتوقّع⊇[${(c.expectBlocking ?? []).join(",")}]`,
      ].filter(Boolean).join(" · ");
      failures.push(`${c.id}: ${why}`);
      console.log(`✗ ${c.id} — ${c.titleAr} → ${why}`);
    }
  }

  // خلاصة شروط النجاح (§29): لا حالة عدائيّة اجتازت، ولا حالة ذهبيّة رُفضت.
  const adv = JUDICIAL_EVAL_CASES.filter((c) => c.category === "adversarial").length;
  const gold = JUDICIAL_EVAL_CASES.filter((c) => c.category === "golden").length;
  console.log(`\nحالات: ${JUDICIAL_EVAL_CASES.length} (عدائيّة ${adv} / ذهبيّة ${gold})`);
  console.log(`نتيجة التقييم: ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) {
    console.log("\nإخفاقات:\n - " + failures.join("\n - "));
    process.exit(1);
  }
  console.log("\n✅ شروط §29 القابلة للفحص النقيّ محقّقة: منع تجاوز الطلبات، فصل الطرق، منع خلط الأصوات، الاتّساق، الوسم.");
}

main();
