/**
 * diagnose-text-quality.ts — تشخيص قرائي لجودة **عرض** نصوص الأنظمة والأحكام.
 *
 * يرصد الشذوذ الذي يسبّب «كلمات مقطوعة/متداخلة/نصوص غير واضحة»:
 *  - محارف صفرية العرض/تحكّم/اتجاه (zero-width · bidi controls · soft hyphen).
 *  - محرف الاستبدال U+FFFD (تلف ترميز).
 *  - تسرّب HTML (وسوم/كيانات).
 *  - كلمات ملتصقة (توكن عربي طويل بلا مسافة) ومقاطع طويلة بلا فراغ (مسافات مفقودة).
 *  - تطويل متكرّر، فراغات/أسطر زائدة.
 *  - التصاق لاتيني↔عربي بلا مسافة (خطر تشابك ثنائي الاتجاه).
 *
 * يعدّ لكل حقل، ويجمع عيّنات «غير قابلة للإصلاح الآلي» (ملتصقة/تالفة) للمراجعة اليدوية.
 * قراءة فقط. التشغيل: npm run diagnose:text-quality
 *   متغيّرات: TQ_SAMPLES=60  TQ_GLUE=28
 */
import { prisma } from "@/lib/prisma";

const SAMPLES = Number(process.env.TQ_SAMPLES || 60);
const GLUE = Number(process.env.TQ_GLUE || 28);
const BATCH = 500;

// نطاقات العربية عبر \u (بلا محارف حرفية غير مرئية).
const AR = "\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF";

const RE: Record<string, RegExp> = {
  // صفرية العرض U+200B..U+200D, U+FEFF + اتجاه ثنائي U+200E/F,U+202A-E,U+2066-9 + soft hyphen U+00AD
  zeroWidth: new RegExp("[\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF\\u00AD]"),
  replacement: new RegExp("\\uFFFD"),
  control: new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"),
  htmlLeak: /&[a-zA-Z#0-9]+;|<\/?[a-zA-Z][^>]*>/,
  tatweelRun: new RegExp("\\u0640{2,}"),
  multiSpace: / {3,}|\t/,
  manyNewlines: /\n{4,}/,
  latinArabicGlue: new RegExp(`[A-Za-z][${AR}]|[${AR}][A-Za-z]`),
};

const AR_SPLIT = new RegExp(`[^${AR}]+`);
function longestArabicRun(s: string): number {
  let max = 0;
  for (const tok of s.split(AR_SPLIT)) if (tok.length > max) max = tok.length;
  return max;
}
function longestNonSpace(s: string): number {
  let max = 0;
  for (const tok of s.split(/\s+/)) if (tok.length > max) max = tok.length;
  return max;
}

type Cat = string;
const CATS: Cat[] = [...Object.keys(RE), "gluedArabic", "longNoSpace"];
const LABEL: Record<Cat, string> = {
  zeroWidth: "محارف صفرية/اتجاه",
  replacement: "محرف استبدال (تلف)",
  control: "محارف تحكّم",
  htmlLeak: "تسرّب HTML",
  tatweelRun: "تطويل متكرّر",
  multiSpace: "فراغات زائدة/تبويب",
  manyNewlines: "أسطر فارغة زائدة",
  latinArabicGlue: "التصاق لاتيني-عربي",
  gluedArabic: "كلمات عربية ملتصقة",
  longNoSpace: "مقطع طويل بلا فراغ",
};
const UNFIXABLE = new Set<Cat>(["replacement", "gluedArabic", "longNoSpace", "htmlLeak"]);

function detect(s: string): Cat[] {
  if (!s) return [];
  const hits: Cat[] = [];
  for (const k of Object.keys(RE)) if (RE[k].test(s)) hits.push(k);
  if (longestArabicRun(s) > GLUE) hits.push("gluedArabic");
  if (longestNonSpace(s) > GLUE + 12) hits.push("longNoSpace");
  return hits;
}

function snippet(s: string, cat: Cat): string {
  let idx = 0;
  if (cat === "gluedArabic" || cat === "longNoSpace") {
    for (const tok of s.split(/\s+/)) if (tok.length > GLUE) { idx = s.indexOf(tok); break; }
  } else if (RE[cat]) {
    const m = RE[cat].exec(s);
    if (m) idx = m.index;
  }
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + s.slice(start, idx + 80).replace(/\n/g, "⏎") + "…";
}

async function main() {
  console.log("=".repeat(80));
  console.log("تشخيص جودة عرض نصوص الأنظمة والأحكام - قراءة فقط");
  console.log("=".repeat(80));

  const mk = () => Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Cat, number>;
  const counts: Record<string, Record<Cat, number>> = {
    "article.title": mk(), "article.content": mk(), "judgment.text": mk(), "judgment.appeal": mk(),
  };
  const totals: Record<string, number> = { "article.title": 0, "article.content": 0, "judgment.text": 0, "judgment.appeal": 0 };
  const unresolved: Array<{ field: string; id: string; cat: Cat; snippet: string }> = [];

  function scan(field: string, id: string, text: string | null) {
    totals[field] += 1;
    for (const c of detect(text ?? "")) {
      counts[field][c] += 1;
      if (UNFIXABLE.has(c) && unresolved.filter((u) => u.cat === c).length < SAMPLES) {
        unresolved.push({ field, id, cat: c, snippet: snippet(text as string, c) });
      }
    }
  }

  let cursor = "";
  for (;;) {
    const rows = await prisma.legalArticle.findMany({
      where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: BATCH,
      select: { id: true, title: true, content: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) { scan("article.title", r.id, r.title); scan("article.content", r.id, r.content); }
  }

  cursor = "";
  for (;;) {
    const rows = await prisma.judicialCase.findMany({
      where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: BATCH,
      select: { id: true, judgmentText: true, appealText: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) { scan("judgment.text", r.id, r.judgmentText); scan("judgment.appeal", r.id, r.appealText); }
  }

  for (const field of Object.keys(counts)) {
    console.log(`\n# ${field}  (اجمالي ${totals[field].toLocaleString("en-US")} حقل):`);
    for (const c of CATS) {
      const n = counts[field][c];
      if (n > 0) console.log(`   ${LABEL[c].padEnd(22, " ")} ${n.toLocaleString("en-US")}${UNFIXABLE.has(c) ? "  * يحتاج مراجعة" : "  (قابل للاصلاح اليًا)"}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`عيّنات غير قابلة للاصلاح الالي (لا نخمّن نصًّا قانونيًا) - ${unresolved.length} مثالًا:`);
  console.log("<BEGIN-UNRESOLVED-JSONL>");
  for (const u of unresolved) console.log(JSON.stringify(u));
  console.log("<END-UNRESOLVED-JSONL>");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("x فشل تشخيص جودة النص:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
