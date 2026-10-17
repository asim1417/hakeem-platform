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
// صيغ البريد الواردة في الأحكام (عناوين مصطنعة): أرقام هندية، مسافة حول @ والنقطة، جزء مطموس، «>» مكان النقطة.
const leakEmail = (t: string) => /@|example|testmail/i.test(redactPII(t)) || !redactPII(t).includes("[بريد محجوب]");
for (const [t, m] of [
  ["البريد: ahmed١٢٣٤@example.com - المدعي", "بريد بأرقام هندية"],
  ["بريده (s.ali٢٠٢٠@testmail.com)، وجواله", "بريد بأرقام هندية بين قوسين"],
  ["المراسلة ahmed. sami9 @ example. com، وعليه", "بريد بمسافات حول @ والنقطة"],
  ["البريد: ahmed(...)@example.com - المدعى عليه", "بريد مطموس جزئيًا (...)"],
  ["البريد الإلكتروني: (***@example.com)، وعليه", "بريد مطموس بنجوم"],
  ["البريد: (ali١٢٣@example>com)، وعليه", "بريد بـ«>» مكان النقطة"],
  ["٢٠٢٠١٢٣٤٥٦ahmed99@example.comالمدعي", "بريد ملتصق بأرقام وحروف عربية"],
] as const) ok(!leakEmail(t), m);
ok(redactPII("بريده (ahmed@example.com) ثم").includes("([بريد محجوب]) ثم"), "القوسان حول البريد يبقيان");
ok(redactPII("قال المدعي. ثم أضاف @ المحكمة") === "قال المدعي. ثم أضاف @ المحكمة", "@ في نص عربي لا يُحجب");
ok(redactPII("انتهى. والمادة 5 من النظام").includes("انتهى. والمادة 5"), "نقطة ومسافة في نص عربي لا تُحجب");
ok(redactPII("جوال 05 0123 4567").includes("[جوال محجوب]"), "جوال بمسافات");
ok(redactPII("المادة 18 من النظام").includes("المادة 18"), "رقم مادة لا يُحجب");
ok(redactPII("المادة 7").includes("7"), "مادة مفردة لا تُحجب");
ok(redactPII("صك 1234567890").includes("1234567890"), "رقم صك لا يُحجب");
ok(redactPII("نُشر 1448/4/7").includes("1448/4/7"), "تاريخ لا يُحجب");
ok(redactPII("عام 1445").includes("1445"), "سنة هجرية لا تُحجب");

console.log(failed === 0 ? "✓ حجب العرض" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
