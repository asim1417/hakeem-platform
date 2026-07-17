// اختبار الإفصاح الصادق (المرحلة ٤) — نقيّ.
import { buildScopeDisclosure, systemsFromArticles } from "@/lib/modules/agents/thinking/disclosure";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

// جزئيّ: عيّنة عبر أنظمة → يذكر الأنظمة + تنبيه «قد توجد أخرى».
{
  const d = buildScopeDisclosure({ systems: ["نظام العمل", "نظام المعاملات المدنية"], dimension: "المدد", complete: false });
  check("يذكر الأنظمة بالاسم", d.includes("نظام العمل") && d.includes("نظام المعاملات المدنية"));
  check("يذكر العدد (نظامين)", d.includes("نظامين"));
  check("تنبيه جزئيّ يذكر البُعد", d.includes("قد توجد المدد أخرى"));
}

// كامل: نظام واحد مُسِح كاملًا → بلا تنبيه «قد توجد أخرى».
{
  const d = buildScopeDisclosure({ systems: ["نظام المعاملات المدنية"], dimension: "المدد", complete: true });
  check("الكامل بلا تنبيه «قد توجد أخرى»", !d.includes("قد توجد"));
  check("الكامل يذكر النظام", d.includes("نظام المعاملات المدنية"));
}

// بلا أنظمة → لا إفصاح (لا نضيف ضجيجًا).
check("بلا أنظمة → نصّ فارغ", buildScopeDisclosure({ systems: [] }) === "");

// استخراج الأنظمة الفريدة بالترتيب.
check("systemsFromArticles فريد ومرتّب", (() => {
  const s = systemsFromArticles([{ systemName: "أ" }, { systemName: "ب" }, { systemName: "أ" }, { systemName: "" }]);
  return s.length === 2 && s[0] === "أ" && s[1] === "ب";
})());

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
