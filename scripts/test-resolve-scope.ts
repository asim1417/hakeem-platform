// اختبار تحديد النظام بالنموذج (المرحلة ١) — نقيّ بحقن provider/registry.
// يُثبت المنطق: النموذج يفهم → التحقّق بالسجلّ (منع الهلوسة) → السقوط للمكنز.
import { resolveGoverningSystems, matchNameToRegistry, fallbackScope } from "@/lib/modules/agents/thinking/resolve-scope";
import type { SystemRef } from "@/lib/modules/agents/substrate/systems-registry";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

const REG: SystemRef[] = [
  { id: "s-ahwal", name: "نظام الأحوال الشخصية" },
  { id: "s-civil", name: "نظام المعاملات المدنية" },
  { id: "s-jaza", name: "نظام الإجراءات الجزائية" },
  { id: "s-labor", name: "نظام العمل" },
];
// provider مزيّف: يردّ JSON كما لو فهم النموذج.
const model = (content: string) => async () => ({ ok: true, content, mode: "server" as const, provider: "fake" });
const offline = async () => ({ ok: false, content: "", mode: "offline" as const, provider: "offline" });

async function main() {
  // ① القبول الجوهري: «فسخ الزوجة» بلا ذكر نظام → النموذج يُرجع الأحوال الشخصية، ويُتحقَّق.
  {
    const r = await resolveGoverningSystems("فسخ الزوجة لعقد الزواج", {
      registry: REG,
      provider: model('{"systems":["الأحوال الشخصية"],"reasoning":"الخلع/التفريق"}'),
    });
    check("«فسخ الزوجة» → الأحوال الشخصية (فهمًا، بلا ذكر نظام)", r.source === "model" && r.systems.length === 1 && r.systems[0].id === "s-ahwal");
  }

  // ② منع الهلوسة: نظام لا وجود له في القاعدة → يُهمَل.
  {
    const r = await resolveGoverningSystems("سؤال ما", {
      registry: REG,
      provider: model('{"systems":["نظام الفضاء الخارجي","الأحوال الشخصية"],"reasoning":"x"}'),
    });
    check("النظام المُختلَق يُحجَب، والموجود يُقبَل", r.systems.length === 1 && r.systems[0].id === "s-ahwal");
  }

  // ③ نظام مُختلَق بالكامل → لا systems من النموذج → سقوط.
  {
    const r = await resolveGoverningSystems("متى يسقط حقّي في المطالبة؟", {
      registry: REG,
      provider: model('{"systems":["نظام غير موجود إطلاقًا"],"reasoning":"x"}'),
    });
    check("كل المقترحات مُختلَقة → سقوط للمكنز (لا model)", r.source !== "model");
  }

  // ④ السقوط عند offline: يعتمد المكنز (concept-map: المطالبة/التقادم → المعاملات المدنية).
  {
    const r = await resolveGoverningSystems("الغبن في المعاملات المدنية", { registry: REG, provider: offline });
    check("offline → fallback يعتمد المكنز/الاسم الصريح", r.source === "fallback" && r.systems.some((s) => s.id === "s-civil"));
  }

  // ⑤ تعدّد الأنظمة من النموذج → كلها تُتحقَّق.
  {
    const r = await resolveGoverningSystems("سؤال متعدّد", {
      registry: REG,
      provider: model('{"systems":["الأحوال الشخصية","العمل"],"reasoning":"x"}'),
    });
    check("تعدّد أنظمة من النموذج يُتحقَّق كلّه", r.systems.length === 2 && r.systems.some((s) => s.id === "s-ahwal") && r.systems.some((s) => s.id === "s-labor"));
  }

  // ⑥ مطابقة الاسم بالسجلّ (تطبيع + احتواء ثنائيّ الاتجاه).
  check("«الأحوال الشخصية» ⇄ «نظام الأحوال الشخصية»", matchNameToRegistry("الأحوال الشخصية", REG).some((r) => r.id === "s-ahwal"));
  check("اسم غير موجود → لا مطابقة", matchNameToRegistry("قانون المريخ", REG).length === 0);
  check("fallbackScope يلتقط الاسم الصريح", fallbackScope("سؤال في نظام العمل", REG).some((r) => r.id === "s-labor"));

  console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
