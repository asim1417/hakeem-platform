// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §20 — تحقّق بُناة الاعتراضات (نقيّ).
// يفحص: العناصر الشكليّة، تصنيف الأسباب بالمدوّنة، رصد خلط مصطلح الطريق، الجاهزيّة.
//   npm run test:jds-objections
// ─────────────────────────────────────────────────────────────────────────────
import { buildObjection, objectionRouteSpec } from "@/lib/modules/judicial";

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

function main() {
  // ① الطرق الأربعة لها مواصفات.
  for (const r of ["APPEAL", "CASSATION", "RECONSIDERATION", "EXECUTION_DISPUTE"] as const) {
    check(`مواصفة ${r} موجودة`, objectionRouteSpec(r).requiredElementsAr.length > 0);
  }

  // ② لائحةٌ ناقصةُ العناصر ⇒ غير جاهزةٍ للإيداع + قائمة نواقص.
  const empty = buildObjection({ route: "CASSATION" });
  check("لائحةٌ فارغة: غير جاهزة", empty.readyToFile === false);
  check("لائحةٌ فارغة: نواقص = كلّ العناصر", empty.missingElements.length === objectionRouteSpec("CASSATION").requiredElementsAr.length);

  // ③ خلط مصطلح طريقٍ آخر يُرصَد (JG14).
  const mixed = buildObjection({ route: "APPEAL", draftText: "نستأنف هذا الحكم ونلتمس نقضه." });
  check("خلط «نقض» في لائحة استئناف يُرصَد", mixed.routeTermConflicts.includes("نقض"));
  check("مع خلطٍ: غير جاهزة", mixed.readyToFile === false);

  // ④ سببٌ من المدوّنة يُعترَف به؛ وسببٌ خارجها يُعلَّم غير قياسيّ.
  const grounds = buildObjection({
    route: "CASSATION",
    selectedGrounds: ["الإخلال بحقّ الدفاع", "سببٌ مبتكَرٌ خارج النظام"],
  });
  check("سببٌ من المدوّنة معترَفٌ به", grounds.recognizedGrounds.length === 1);
  check("سببٌ خارج المدوّنة يُعلَّم غير قياسيّ", grounds.nonStandardGrounds.length === 1);

  // ⑤ لائحةٌ مكتملةُ العناصر + سببٌ معترَفٌ به + بلا خلط ⇒ جاهزة.
  const spec = objectionRouteSpec("APPEAL");
  const ready = buildObjection({
    route: "APPEAL",
    providedElements: spec.requiredElementsAr,
    selectedGrounds: ["قصور في التسبيب"],
    draftText: "نستأنف الحكم للأسباب الآتية.",
  });
  check("لائحةٌ مكتملة: بلا نواقص", ready.missingElements.length === 0);
  check("لائحةٌ مكتملة: جاهزةٌ للإيداع", ready.readyToFile === true);
  check("المصطلح القياسيّ للاستئناف «نستأنف»", ready.canonicalTermAr === "نستأنف");

  console.log(`\nنتيجة §20 (objections): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
