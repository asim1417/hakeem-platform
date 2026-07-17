// اختبار بوّابة الاتّساع — نقيّ. قبول: المحدّد → لا استيضاح؛ الاستقصائي → خيارات؛ الملتبس → خياران.
import { detectBreadth } from "@/lib/modules/agents/breadth-gate";
import { classifyBreadthDeterministic } from "@/lib/modules/agents/breadth-classifier";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

// ① واسع: «ما هي المدد في الأنظمة السعودية» (بلا نظام) → خيارات ٢–٣.
{
  const b = detectBreadth("ما هي المدد في الأنظمة السعودية", { hasSystem: false });
  check("«كل المدد في الأنظمة» → استيضاح", !!b && b.options.length >= 2 && b.options.length <= 3);
  check("يتضمّن خيار الاستقصاء الشامل", !!b && b.options.some((o) => o.exhaustive));
  check("الخيارات المركّزة قابلة للتنفيذ (استعلام غير فارغ)", !!b && b.options.every((o) => o.query.trim().length > 0));
  check("الحدّ الأقصى ٣ خيارات", !!b && b.options.length <= 3);
}

// ② استقصائيّ بنظام مذكور (كل + نظام) → لا استيضاح (يتولّاه المسح الكامل للنظام).
check("«كل المدد في نظام العمل» → لا استيضاح (مسح كامل)", detectBreadth("ما هي كل المدد في نظام العمل", { hasSystem: true }) === null);

// ③ محدّد بلا علامة حصر → لا استيضاح («مدة الاستئناف»).
check("«مدة الاستئناف» (محدّد، بلا حصر) → لا استيضاح", detectBreadth("كم مدة الاستئناف؟", { hasSystem: false }) === null);

// ③.٢ [الإصلاح الجوهريّ] محدّد بفاتحة سؤال «ما هي» + مفرد → لا استيضاح (لا يُعامَل كاستقصاء).
check("«ما هي مدة الاستئناف» (محدّد) → لا استيضاح", detectBreadth("ما هي مدة الاستئناف؟", { hasSystem: false }) === null);
check("«عقوبة الرشوة» (محدّد) → لا استيضاح", detectBreadth("ما هي عقوبة الرشوة؟", { hasSystem: false }) === null);

// ③.٣ ملتبس: جمعٌ + نظام مذكور بلا شمول صريح → استيضاح بخيارين (مباشر · شامل).
{
  const b = detectBreadth("المدد في نظام العمل", { hasSystem: true });
  check("«المدد في نظام العمل» (ملتبس) → استيضاح", !!b && b.options.length === 2);
  check("الملتبس يعرض خيار الجواب المباشر", !!b && b.options.some((o) => o.id === "direct"));
  check("الملتبس يعرض خيار الاستقصاء", !!b && b.options.some((o) => o.exhaustive));
}

// ④ حصر بلا بُعد واسع معروف → لا استيضاح (لا نغرق كل سؤال).
check("حصر بلا بُعد معروف → لا استيضاح", detectBreadth("ما هي كل التعريفات؟", { hasSystem: false }) === null);

// ⑤ بُعد آخر (عقوبات) واسع → استيضاح بعنوان مناسب.
{
  const b = detectBreadth("اذكر جميع العقوبات في الأنظمة", { hasSystem: false });
  check("«جميع العقوبات» → استيضاح ببُعد العقوبات", !!b && b.dimension.includes("العقوبات"));
}

// ⑥ الرسالة تذكر البُعد.
{
  const b = detectBreadth("ما هي كل المدد", { hasSystem: false });
  check("الرسالة تذكر البُعد (المدد)", !!b && b.message.includes("المدد"));
}

// ⑦ المصنّف الحتميّ (٣ فئات) — المعيار المرجعيّ.
const cls = (q: string, hasSystem: boolean, hasDimension = true) => classifyBreadthDeterministic(q, { hasSystem, hasDimension });
check("«موعد صرف الأجر» → محدّد", cls("ما هو موعد صرف الأجر", false) === "specific");
check("«مدة الاستئناف» → محدّد", cls("ما هي مدة الاستئناف", false) === "specific");
check("«عقوبة الرشوة» → محدّد", cls("عقوبة الرشوة", false) === "specific");
check("«كل المدد في الأنظمة» → استقصائي", cls("ما هي كل المدد في الأنظمة السعودية", false) === "exhaustive");
check("«اذكر جميع العقوبات» → استقصائي", cls("اذكر جميع العقوبات", false) === "exhaustive");
check("«ما هي المدد في الأنظمة» (جمع+عبر الأنظمة) → استقصائي", cls("ما هي المدد في الأنظمة السعودية", false) === "exhaustive");
check("«المدد في نظام العمل» (جمع+نظام) → ملتبس", cls("المدد في نظام العمل", true) === "ambiguous");
check("بلا بُعد → محدّد", cls("ما هي شروط الزواج", false, false) === "specific");

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
