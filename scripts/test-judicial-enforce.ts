// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §27 — تحقّق الوصل الفعّال (JDS_ENFORCE) — نقيّ.
// يفحص: بلا عَلَم = undefined؛ الظلّ = يرصد بلا منع؛ الإنفاذ = يمنع الاعتماد + إشعار.
//   npm run test:jds-enforce
// ─────────────────────────────────────────────────────────────────────────────
import { judicialShadowReview } from "@/lib/modules/judicial";

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

// مسودّةٌ مخالِفة: صوت المحكمة الحاسم في مذكّرة محامٍ (JG13 مانعة).
const violating = {
  role: "LAWYER" as const,
  documentFunction: "DEFENSE" as const,
  draftText: "نطلب رفض الدعوى، وقد حكمت الدائرة بذلك.",
};

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(env)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

function main() {
  // ① بلا أعلام ⇒ لا مراجعة.
  withEnv({ JDS_DRAFTING_SHADOW: undefined, JDS_ENFORCE: undefined }, () => {
    check("بلا عَلَم: undefined (لا مراجعة)", judicialShadowReview(violating) === undefined);
  });

  // ② الظلّ فقط ⇒ يرصد المخالفة لكن لا يمنع الاعتماد ولا إشعار.
  withEnv({ JDS_DRAFTING_SHADOW: "1", JDS_ENFORCE: undefined }, () => {
    const r = judicialShadowReview(violating)!;
    check("الظلّ: يوجد", !!r);
    check("الظلّ: يرصد مخالفةً مانعة (JG13)", r.blocking.includes("JG13"));
    check("الظلّ: enforced=false", r.enforced === false);
    check("الظلّ: لا يمنع الاعتماد", r.releaseBlocked === false);
    check("الظلّ: بلا إشعارٍ تصحيحيّ", r.banner === null);
  });

  // ③ الإنفاذ ⇒ يمنع الاعتماد + إشعارٌ تصحيحيّ يذكر البوّابة.
  withEnv({ JDS_ENFORCE: "1" }, () => {
    const r = judicialShadowReview(violating)!;
    check("الإنفاذ: enforced=true", r.enforced === true);
    check("الإنفاذ: يمنع الاعتماد", r.releaseBlocked === true);
    check("الإنفاذ: يوجد إشعارٌ تصحيحيّ", typeof r.banner === "string" && r.banner.length > 0);
    check("الإنفاذ: الإشعار يذكر أمانة اللغة (JG13)", (r.banner ?? "").includes("اللغة") || (r.banner ?? "").includes("JG13"));
  });

  // ④ الإنفاذ لمخرجٍ نظيف ⇒ لا منع ولا إشعار.
  withEnv({ JDS_ENFORCE: "1" }, () => {
    const clean = judicialShadowReview({
      role: "LAWYER",
      documentFunction: "DEFENSE",
      draftText: "يتمسك موكلي بالدفع بعدم القبول، ويدفع بأنّ الخصم لم يقدّم ما يثبت دعواه.",
    })!;
    check("الإنفاذ+نظيف: لا يمنع الاعتماد", clean.releaseBlocked === false);
    check("الإنفاذ+نظيف: بلا إشعار", clean.banner === null);
  });

  console.log(`\nنتيجة §27 (enforce): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
