// اختبار بوّابة الاتّساع (المرحلة ١) — نقيّ. قبول: الواسع → خيارات؛ المحدّد → لا استيضاح.
import { detectBreadth } from "@/lib/modules/agents/breadth-gate";

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

// ② محدّد بنظام مذكور → لا استيضاح (hasSystem=true).
check("نظام مذكور → لا استيضاح", detectBreadth("ما هي كل المدد في نظام العمل", { hasSystem: true }) === null);

// ③ محدّد بلا علامة حصر → لا استيضاح («مدة الاستئناف»).
check("«مدة الاستئناف» (محدّد، بلا حصر) → لا استيضاح", detectBreadth("كم مدة الاستئناف؟", { hasSystem: false }) === null);

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

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
