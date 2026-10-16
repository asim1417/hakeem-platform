import { redactPII } from "../lib/modules/legal-core/rulings-search";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

ok(!redactPII("هوية 1012345678").includes("1012345678"), "هوية متصلة");
ok(!redactPII("هوية 1 0 1 2 3 4 5 6 7 8").includes("1 0 1 2 3 4 5 6 7 8"), "هوية بمسافات");
ok(redactPII("البريد a@example.com").includes("[بريد محجوب]"), "بريد");
ok(redactPII("جوال 05 0123 4567").includes("[جوال محجوب]"), "جوال بمسافات");
ok(redactPII("المادة 18 من النظام").includes("المادة 18"), "رقم مادة لا يُحجب");
ok(redactPII("المادة 7").includes("7"), "مادة مفردة لا تُحجب");
ok(redactPII("صك 1234567890").includes("1234567890"), "رقم صك لا يُحجب");
ok(redactPII("نُشر 1448/4/7").includes("1448/4/7"), "تاريخ لا يُحجب");
ok(redactPII("عام 1445").includes("1445"), "سنة هجرية لا تُحجب");

console.log(failed === 0 ? "✓ حجب العرض" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
