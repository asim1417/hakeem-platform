// اختبار قبول بوّابة النيّة (المرحلة ١) — حتمي، بلا قاعدة بيانات.
// npm run test:intent-gate
import { classifyIntent, intentNeedsSearch } from "../lib/modules/agents/intent-gate";

type Case = { input: string; expect: string; search: boolean };
const cases: Case[] = [
  { input: "السلام عليكم", expect: "greeting", search: false },
  { input: "مرحبا", expect: "greeting", search: false },
  { input: "صباح الخير", expect: "greeting", search: false },
  { input: "شكرا جزيلا", expect: "thanks", search: false },
  { input: "من انت؟", expect: "meta", search: false },
  { input: "ماذا تستطيع أن تفعل؟", expect: "meta", search: false },
  { input: "ما هي وصفة الكبسة؟", expect: "non_legal", search: false },
  // أسئلة قانونية حقيقية → تمرّ للبحث
  { input: "ما مدة إشعار إنهاء عقد العمل؟", expect: "legal_question", search: true },
  { input: "نصّ المادة 226 من نظام المعاملات المدنية", expect: "legal_question", search: true },
  { input: "نظام العمل والإجازات", expect: "legal_question", search: true },
  { input: "شروط فسخ عقد الإيجار", expect: "legal_question", search: true },
  // تحية + سؤال قانوني → يمرّ (لا يُحجب)
  { input: "السلام عليكم، ما شروط الشفعة؟", expect: "legal_question", search: true },
  // غامض قصير
  { input: "؟", expect: "ambiguous", search: false },
];

let pass = 0;
const fails: string[] = [];
for (const c of cases) {
  const r = classifyIntent(c.input);
  const ok = r.type === c.expect && intentNeedsSearch(r.type) === c.search;
  if (ok) pass += 1;
  else fails.push(`✗ «${c.input}» → ${r.type} (search=${intentNeedsSearch(r.type)})  [متوقّع ${c.expect}/search=${c.search}]`);
  console.log(`${ok ? "✓" : "✗"}\t${c.input}\t→ ${r.type}${r.reply ? "  ردّ: " + r.reply.slice(0, 40) + "…" : ""}`);
}
console.log(`\nنتيجة: ${pass}/${cases.length} نجح`);
if (fails.length) {
  console.log(fails.join("\n"));
  process.exit(1);
}
