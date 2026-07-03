/**
 * test-lexicon-expansion.ts — اختبار توسيع البحث بالمعجم الصرفيّ (بيانات وهمية، بلا قاعدة).
 * التشغيل: npm run test:lexicon
 */
import fs from "node:fs";
import { expandToken, lexiconStats, _resetLexicon } from "@/lib/modules/legal-core/lexicon-expansion";

const lex = { roots: { "دعو": ["ادعى", "دعاوى", "دعوى", "مدعي", "مدعية", "يدعي"], "عقد": ["عقد", "عقود"] } };
fs.writeFileSync("/tmp/lex-test.json", JSON.stringify(lex));
process.env.LEXICON_PATH = "/tmp/lex-test.json";
_resetLexicon();

const cases: [string, string[]][] = [
  ["الدعوى", ["ادعى", "دعاوى", "مدعي", "مدعية", "يدعي"]],
  ["عقود", ["عقد"]],
  ["مدعية", ["ادعى", "دعاوى", "دعوى", "مدعي", "يدعي"]],
  ["كلمةغيرموجودة", []],
];
let ok = 0, bad = 0;
for (const [q, exp] of cases) {
  const got = expandToken(q).sort();
  const want = [...exp].sort();
  const pass = JSON.stringify(got) === JSON.stringify(want);
  pass ? ok++ : bad++;
  console.log(`${pass ? "✓" : "✗"} expand(«${q}») = [${got.join("،")}]${pass ? "" : `  متوقع [${want.join("،")}]`}`);
}
console.log(`stats: ${JSON.stringify(lexiconStats())}`);
console.log(`\n${ok} ناجح · ${bad} فاشل`);
if (bad) process.exit(1);
