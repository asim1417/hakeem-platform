/**
 * audit-core-systems.ts — فحص دقيق (قراءة فقط) للأنظمة الأساسية الأحد‑عشر ولوائحها في القاعدة.
 * v2: مطابقة **مطبَّعة** (إزالة الهمزات/التطويل، ة→ه، ى→ي) وبالكلمات المميّزة (لا بالتجاور)،
 * بعد أن أخفقت v1 في مطابقة «الأحوال الشخصية»/«الإجراءات الجزائية» (همزة + «ال» فاصلة).
 * لا كتابة. يُشغَّل عبر workflow ضدّ Neon.
 */
import { prisma } from "@/lib/prisma";

function norm(s: string): string {
  return (s || "")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "")
    .replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();
}

// لكل نظام: كلمات مميّزة (كلها يجب أن ترد في الاسم المُطبَّع) + الاسم القانوني المُطبَّع لتمييز «النظام» الأصل.
const TARGETS: Array<{ label: string; tokens: string[]; canon: string }> = [
  { label: "المعاملات المدنية", tokens: ["معاملات", "مدنيه"], canon: "نظام المعاملات المدنيه" },
  { label: "المرافعات الشرعية", tokens: ["مرافعات", "شرعيه"], canon: "نظام المرافعات الشرعيه" },
  { label: "الإثبات", tokens: ["اثبات"], canon: "نظام الاثبات" },
  { label: "الأحوال الشخصية", tokens: ["احوال", "شخصيه"], canon: "نظام الاحوال الشخصيه" },
  { label: "الإجراءات الجزائية", tokens: ["اجراءات"], canon: "نظام الاجراءات الجزائيه" },
  { label: "الشركات", tokens: ["شركات"], canon: "نظام الشركات" },
  { label: "المحاكم التجارية", tokens: ["محاكم", "تجاريه"], canon: "نظام المحاكم التجاريه" },
  { label: "العمل", tokens: ["عمل"], canon: "نظام العمل" },
  { label: "الإفلاس", tokens: ["افلاس"], canon: "نظام الافلاس" },
  { label: "التوثيق", tokens: ["توثيق"], canon: "نظام التوثيق" },
  { label: "التحكيم", tokens: ["تحكيم"], canon: "نظام التحكيم" },
];

const AR = /[ء-غف-يٮ-ۓ]/;
function longestGlue(s: string): number { let m = 0, c = 0; for (const ch of s) { if (AR.test(ch)) { c++; if (c > m) m = c; } else c = 0; } return m; }
const isReg = (n: string) => /لايحه|لايحه\s*تنفيذيه|تنظيميه/.test(norm(n));

async function statsFor(systemId: string, name: string) {
  let arts = await prisma.legalArticle.findMany({ where: { legalSystemId: systemId }, select: { articleNumber: true, content: true } });
  if (!arts.length) arts = await prisma.legalArticle.findMany({ where: { lawName: name }, select: { articleNumber: true, content: true } });
  const nums = arts.map((a) => a.articleNumber).filter((n) => Number.isFinite(n));
  const uniq = new Set(nums);
  const max = nums.length ? Math.max(...nums) : 0;
  const min = nums.length ? Math.min(...nums.filter((n) => n > 0)) : 0;
  const empty = arts.filter((a) => !a.content || a.content.trim().length < 15).length;
  const glued = arts.filter((a) => longestGlue(a.content || "") > 28).length;
  let gaps = 0; if (max > 0 && max < 5000) for (let i = 1; i <= max; i++) if (!uniq.has(i)) gaps++;
  return { count: arts.length, uniq: uniq.size, dups: nums.length - uniq.size, min, max, empty, glued, gaps };
}

async function main() {
  console.log("═".repeat(92));
  console.log("فحص الأنظمة الأساسية الأحد‑عشر ولوائحها — v2 (مطابقة مطبَّعة) · قراءة فقط");
  console.log("═".repeat(92));

  const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true, classification: true, domain: true, articleCount: true } });
  const N = systems.map((s) => ({ ...s, n: norm(s.name) }));
  console.log(`إجمالي الأنظمة: ${systems.length}\n`);

  let missing = 0;
  for (const t of TARGETS) {
    const matches = N.filter((s) => t.tokens.every((tok) => s.n.includes(tok)));
    const mains = matches.filter((s) => !isReg(s.name));
    const regs = matches.filter((s) => isReg(s.name));
    const canonical = mains.find((s) => s.n === t.canon) || mains.slice().sort((a, b) => a.n.length - b.n.length)[0];

    console.log("─".repeat(92));
    console.log(`▮ ${t.label}`);
    if (!mains.length) { console.log(`   ❌ غير موجود.`); missing++; }
    for (const s of mains) {
      const st = await statsFor(s.id, s.name);
      const star = s === canonical ? "★" : "•";
      const flags = [st.dups ? `تكرار=${st.dups}⚠️` : "", st.gaps ? `فجوات=${st.gaps}⚠️` : "", st.empty ? `فارغة=${st.empty}⚠️` : "", st.glued ? `التصاق=${st.glued}` : "", st.count === 0 ? "بلا مواد❌" : ""].filter(Boolean).join(" · ");
      console.log(`   ${star} «${s.name}» — مواد=${st.count} (فريدة=${st.uniq}, نطاق ${st.min}..${st.max}) · تصنيف=${s.classification ?? "∅"} · مجال=${s.domain ?? "∅"}${flags ? `\n       ⚑ ${flags}` : ""}`);
    }
    console.log(`   اللائحة التنفيذية: ${regs.length ? regs.map((r) => `«${r.name}»`).join(" · ") : "✗ لم تُطابَق ضمن كلمات هذا النظام"}`);
  }

  console.log("\n" + "═".repeat(92));
  console.log(`أنظمة أساسية غير موجودة: ${missing}/${TARGETS.length}`);
  // أنظمة بلا مواد (تلوّث)
  let emptyCount = 0; const emptyNames: string[] = [];
  for (const s of N) { const c = await prisma.legalArticle.count({ where: { OR: [{ legalSystemId: s.id }, { lawName: s.name }] } }); if (c === 0) { emptyCount++; if (emptyNames.length < 25) emptyNames.push(s.name); } }
  console.log(`\nأنظمة بلا أي مادة (تلوّث): ${emptyCount}`);
  for (const n of emptyNames) console.log(`   - ${n}`);

  // حسم «الإجراءات الجزائية»: كل نظام حيّ يحوي جزائ/جنائ/اجراءات (مطبَّعًا).
  console.log(`\nكل الأنظمة الحيّة التي تحوي جزائ/جنائ/اجراءات:`);
  const crim = N.filter((s) => /جزائ|جنائ|اجراءات/.test(s.n));
  for (const s of crim) console.log(`   - «${s.name}» (تصنيف=${s.classification ?? "∅"})`);
  if (!crim.length) console.log("   (لا شيء)");

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
