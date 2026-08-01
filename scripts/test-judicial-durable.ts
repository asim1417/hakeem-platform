// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §25 — تحقّق الوكيل الخلفيّ الدائم (مُخفِّضٌ نقيّ).
// يفحص: التهيئة، التقدّم عبر المراحل، انتظار المفوَّضة، الحجز، الاستئناف من التسلسل،
// وأنّ الاعتماد النهائيّ لا يقع إلا بإذنٍ صريح (لا آليًّا).
//   npm run test:jds-durable
// ─────────────────────────────────────────────────────────────────────────────
import {
  initJudicialAgentRun,
  advanceJudicialAgentRun,
  approveJudicialAgentRun,
  serializeAgentRun,
  deserializeAgentRun,
} from "@/lib/modules/judicial";
import type { JudicialAgentRun } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

const AT = "2026-08-01T00:00:00Z"; // طابعٌ زمنيّ ثابت (حتميّة الاختبار)

// يقود التشغيل حتى حالةٍ نهائيّة، مُلبّيًا المراحل المفوَّضة ومُوفّرًا متطلّبات المحجوزة.
function drive(run: JudicialAgentRun, maxSteps = 200): JudicialAgentRun {
  let cur = run;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.status === "READY_FOR_REVIEW" || cur.status === "COMPLETED") break;
    cur = advanceJudicialAgentRun(cur, {
      at: AT,
      delegateFulfilled: cur.status === "AWAITING_DELEGATE",
      requirementResolved: cur.status === "BLOCKED",
    });
  }
  return cur;
}

function main() {
  const base = {
    runId: "run-1",
    taskId: "t1",
    role: "LAWYER" as const,
    text: "تحرير صحيفة دعوى تجاريّة",
    knownFacts: ["أبرم الطرفان عقدًا"],
    availableDocuments: ["العقد"],
    lawAsOfDate: "2026-08-01",
  };

  // ① التهيئة: ٢٢ مرحلة، مؤشّرٌ صفر، حالة INITIALIZED.
  const run0 = initJudicialAgentRun(base);
  check("التهيئة: ٢٢ مرحلة", run0.passes.length === 22);
  check("التهيئة: cursor=0", run0.cursor === 0);
  check("التهيئة: INITIALIZED", run0.status === "INITIALIZED");

  // ② خطوةٌ واحدة على مرحلةٍ حتميّة (تصنيف) ⇒ تُختَم بنقطة تفتيش.
  const run1 = advanceJudicialAgentRun(run0, { at: AT });
  check("بعد خطوة: RUNNING", run1.status === "RUNNING");
  check("بعد خطوة: نقطة تفتيشٍ واحدة", run1.checkpoints.length === 1);
  check("بعد خطوة: cursor=1", run1.cursor === 1);

  // ③ مرحلةٌ مفوَّضة توقف عند AWAITING_DELEGATE حتى الإفادة.
  let cur = run1;
  let sawAwaiting = false;
  for (let i = 0; i < 5; i++) {
    cur = advanceJudicialAgentRun(cur, { at: AT }); // بلا delegateFulfilled
    if (cur.status === "AWAITING_DELEGATE") {
      sawAwaiting = true;
      break;
    }
  }
  check("يتوقّف عند مرحلةٍ مفوَّضة (AWAITING_DELEGATE)", sawAwaiting);
  const stuck = advanceJudicialAgentRun(cur, { at: AT }); // بلا إفادة ⇒ لا تقدّم
  check("بلا إفادةٍ: لا يتقدّم", stuck.status === "AWAITING_DELEGATE" && stuck.pendingDelegateStep === cur.pendingDelegateStep);
  const moved = advanceJudicialAgentRun(cur, { at: AT, delegateFulfilled: true });
  check("بإفادةٍ: يتقدّم", moved.status === "RUNNING" || moved.status === "READY_FOR_REVIEW");

  // ④ القيادة للنهاية ⇒ READY_FOR_REVIEW (لا COMPLETED آليًّا).
  const done = drive(run0);
  check("يبلغ READY_FOR_REVIEW", done.status === "READY_FOR_REVIEW");
  check("لا يُكمَل آليًّا (ليس COMPLETED)", done.status !== "COMPLETED");

  // ⑤ الاعتماد لا يقع إلا بإذنٍ صريح.
  const approved = approveJudicialAgentRun(done, "قاضٍ مُراجِع", AT);
  check("بالإذن الصريح: COMPLETED", approved.status === "COMPLETED");
  check("يسجّل نقطة اعتمادٍ بشريّة", approved.checkpoints.some((c) => c.passId === "HUMAN_APPROVAL"));

  // ⑥ الاستئناف من التسلسل يطابق الحالة (قابليّة الحفظ §25).
  const round = deserializeAgentRun(serializeAgentRun(done));
  check("الاستئناف من JSON يطابق الحالة", round.status === done.status && round.cursor === done.cursor && round.passes.length === 22);

  console.log(`\nنتيجة §25 (durable-agent): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
