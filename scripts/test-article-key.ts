/** HKM-028: مفتاح المادة ووسمها مع «مكرر». */
import { articleKey, articleLabel } from "../lib/modules/legal-core/article-key";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};
ok(articleKey(20) === "20" && articleKey(20, 0) === "20", "الأصل بلا لاحقة");
ok(articleKey(20, 1) === "20_bis" && articleKey(20, 2) === "20_bis2", "«مكرر» كـart_N_bis في hkn-uri");
ok(articleLabel(20, 1) === "20 مكرر" && articleLabel(20, 2) === "20 مكرر 2" && articleLabel(7) === "7", "الوسم");
ok(articleLabel(20, 1, true) === "٢٠ مكرر", "الوسم بالأرقام العربية");
const re = /^(\d+)(?:_bis(\d*))?$/;
const parse = (k: string) => { const m = re.exec(k); return m ? [Number(m[1]), m[2] !== undefined ? Number(m[2] || 1) : 0] : null; };
ok(JSON.stringify(parse(articleKey(20, 1))) === "[20,1]" && JSON.stringify(parse("20")) === "[20,0]" && JSON.stringify(parse(articleKey(5, 2))) === "[5,2]", "صفحة المادة تقرأ المفتاح كما يُكتب");
ok(parse("20-bis") === null && parse("abc") === null, "مفتاح غير صالح");
console.log(failed === 0 ? "✓ مفتاح المادة" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
