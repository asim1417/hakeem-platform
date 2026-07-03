/**
 * audit-core-systems.ts — فحص دقيق (قراءة فقط) للأنظمة الأساسية الأحد‑عشر ولوائحها في القاعدة:
 * الوجود، عدد المواد، سلامة الترقيم (فجوات/تكرار)، نصّ ناقص، التصنيف/المجال، ووجود اللائحة التنفيذية.
 * لا كتابة. يُشغَّل عبر workflow ضدّ Neon.
 */
import { prisma } from "@/lib/prisma";

// الأنظمة المستهدفة + كلمة مميّزة للمطابقة (على اسم النظام في القاعدة).
const TARGETS: Array<{ label: string; key: RegExp }> = [
  { label: "المعاملات المدنية", key: /معاملات\s*مدنية|المعاملات\s*المدنية/ },
  { label: "المرافعات الشرعية", key: /مرافعات/ },
  { label: "الإثبات", key: /الإثبات|الاثبات/ },
  { label: "الأحوال الشخصية", key: /أحوال\s*شخصية|الاحوال\s*الشخصية/ },
  { label: "الإجراءات الجزائية", key: /إجراءات\s*جزائية|الاجراءات\s*الجزائية/ },
  { label: "الشركات", key: /الشركات/ },
  { label: "المحاكم التجارية", key: /محاكم\s*تجارية|المحاكم\s*التجارية/ },
  { label: "العمل", key: /(^|\s)نظام\s*العمل|العمل(\s|$)/ },
  { label: "الإفلاس", key: /إفلاس|الافلاس/ },
  { label: "التوثيق", key: /التوثيق/ },
  { label: "التحكيم", key: /التحكيم/ },
];

// أعداد مواد مرجعية للتحقّق (تقريبية من النصوص الرسمية — للاسترشاد لا للجزم).
const REF_COUNT: Record<string, number> = {
  "المعاملات المدنية": 720, "المرافعات الشرعية": 245, "الإثبات": 141,
  "الأحوال الشخصية": 251, "الإجراءات الجزائية": 227, "الشركات": 281,
  "المحاكم التجارية": 97, "العمل": 245, "الإفلاس": 231, "التوثيق": 96, "التحكيم": 58,
};

const AR = /[ء-غف-يٮ-ۓ]/;
function longestGlue(s: string): number { let m = 0, c = 0; for (const ch of s) { if (AR.test(ch)) { c++; if (c > m) m = c; } else c = 0; } return m; }
const isReg = (name: string) => /لائحة|اللائحة\s*التنفيذية/.test(name);

async function statsFor(systemId: string, name: string) {
  let arts = await prisma.legalArticle.findMany({ where: { legalSystemId: systemId }, select: { articleNumber: true, content: true } });
  if (!arts.length) arts = await prisma.legalArticle.findMany({ where: { lawName: name }, select: { articleNumber: true, content: true } });
  const nums = arts.map((a) => a.articleNumber).filter((n) => Number.isFinite(n));
  const uniq = new Set(nums);
  const dups = nums.length - uniq.size;
  const max = nums.length ? Math.max(...nums) : 0;
  const min = nums.length ? Math.min(...nums.filter((n) => n > 0)) : 0;
  const empty = arts.filter((a) => !a.content || a.content.trim().length < 15).length;
  const glued = arts.filter((a) => longestGlue(a.content || "") > 28).length;
  // فجوات: أرقام مفقودة ضمن [1..max] (لأنظمة مرقّمة تسلسليًّا)
  let gaps = 0; if (max > 0 && max < 5000) { for (let i = 1; i <= max; i++) if (!uniq.has(i)) gaps++; }
  return { count: arts.length, uniq: uniq.size, dups, min, max, empty, glued, gaps };
}

async function main() {
  console.log("═".repeat(90));
  console.log("فحص الأنظمة الأساسية الأحد‑عشر ولوائحها (قراءة فقط)");
  console.log("═".repeat(90));

  const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true, classification: true, domain: true, articleCount: true } });
  console.log(`إجمالي الأنظمة في القاعدة: ${systems.length}\n`);

  const foundRegs: string[] = [];
  let missing = 0;

  for (const t of TARGETS) {
    const matches = systems.filter((s) => t.key.test(s.name));
    const mains = matches.filter((s) => !isReg(s.name));
    const regs = matches.filter((s) => isReg(s.name));
    regs.forEach((r) => foundRegs.push(r.name));

    console.log("─".repeat(90));
    console.log(`▮ ${t.label}`);
    if (!mains.length) { console.log(`   ❌ النظام غير موجود بالقاعدة (أو اسمه مختلف).`); missing++; }
    for (const s of mains) {
      const st = await statsFor(s.id, s.name);
      const ref = REF_COUNT[t.label];
      const refNote = ref ? ` · مرجعيّ~${ref}${st.count !== ref ? ` (فرق ${st.count - ref})` : " ✓"}` : "";
      const flags = [
        st.dups ? `تكرار أرقام=${st.dups}⚠️` : "",
        st.gaps ? `فجوات ترقيم=${st.gaps}⚠️` : "",
        st.empty ? `مواد فارغة=${st.empty}⚠️` : "",
        st.glued ? `التصاق نصّ=${st.glued}` : "",
        st.count === 0 ? "بلا مواد❌" : "",
      ].filter(Boolean).join(" · ");
      console.log(`   • «${s.name}»`);
      console.log(`     مواد=${st.count} (فريدة=${st.uniq}, نطاق ${st.min}..${st.max})${refNote} · تصنيف=${s.classification ?? "∅"} · مجال=${s.domain ?? "∅"} · articleCount(الحقل)=${s.articleCount}`);
      if (flags) console.log(`     ⚑ ${flags}`);
    }
    console.log(`   اللائحة التنفيذية: ${regs.length ? regs.map((r) => `«${r.name}»`).join(" · ") : "✗ غير موجودة"}`);
  }

  console.log("\n" + "═".repeat(90));
  console.log("ملخّص");
  console.log("═".repeat(90));
  console.log(`أنظمة مستهدفة مفقودة: ${missing}/${TARGETS.length}`);
  console.log(`لوائح تنفيذية موجودة ضمن المستهدفة: ${foundRegs.length}`);
  // كل ما يحمل «لائحة» في القاعدة (لرؤية التغطية الكلّية)
  const allRegs = systems.filter((s) => isReg(s.name));
  console.log(`\nكل الأنظمة التي تحمل «لائحة» في القاعدة (${allRegs.length}):`);
  for (const r of allRegs.slice(0, 60)) console.log(`   - ${r.name}`);
  if (allRegs.length > 60) console.log(`   … +${allRegs.length - 60}`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
