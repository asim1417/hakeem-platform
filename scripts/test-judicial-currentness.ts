// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §7 — تحقّق مُحلِّل إثبات السريان (نقيّ، بلا قاعدة).
// يفحص: يُثبت التاريخ فقط عند حاكمٍ ساري؛ يبقى PENDING بلا حاكم؛ لا اختلاق تاريخ.
//   npm run test:jds-currentness
// ─────────────────────────────────────────────────────────────────────────────
import { resolvePackCurrentness, PACK_GOVERNING_SYSTEMS } from "@/lib/modules/judicial";

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
  const DATE = "2026-08-01";

  // ① حاكمٌ ساري ⇒ يُثبَت التاريخ + لقطة.
  const proven = resolvePackCurrentness("LABOR_PACK", DATE, [
    { name: "نظام العمل", active: true, effectiveFrom: "2005-09-27", systemId: "s1" },
  ]);
  check("حاكمٌ ساري: proven", proven.proven === true);
  check("حاكمٌ ساري: التاريخ = as-of", proven.lawAsOfDate === DATE);
  check("حاكمٌ ساري: لقطة سلطةٍ واحدة", proven.snapshots.length === 1 && proven.snapshots[0].systemName === "نظام العمل");

  // ② لا حاكم ⇒ يبقى PENDING (لا اختلاق تاريخ).
  const none = resolvePackCurrentness("LABOR_PACK", DATE, []);
  check("لا حاكم: يبقى PENDING", none.lawAsOfDate === "PENDING" && none.proven === false);
  check("لا حاكم: يُبلّغ عن المفقود", none.missing.length > 0);

  // ③ حاكمٌ موجودٌ لكن غير ساري ⇒ لا يُثبَت.
  const inactive = resolvePackCurrentness("CRIMINAL_PACK", DATE, [
    { name: "نظام الإجراءات الجزائية", active: false, effectiveFrom: null, systemId: "s2" },
  ]);
  check("حاكمٌ غير ساري: يبقى PENDING", inactive.lawAsOfDate === "PENDING" && inactive.proven === false);

  // ④ كلّ حزمةٍ لها أنظمةٌ حاكمة مرشّحة (خريطة كاملة).
  check("خريطة الحاكم تغطّي كلّ الحزم", Object.keys(PACK_GOVERNING_SYSTEMS).length >= 9);
  check("كلّ حزمةٍ لها مرشّحٌ واحدٌ على الأقلّ", Object.values(PACK_GOVERNING_SYSTEMS).every((v) => v.length > 0));

  console.log(`\nنتيجة §7 (currentness): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
