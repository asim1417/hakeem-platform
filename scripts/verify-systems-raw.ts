/**
 * verify-systems-raw.ts — تحقّق **خام** (قراءة فقط) من وجود الأنظمة الأساسية بأسمائها كما هي
 * في القاعدة، عبر ILIKE مباشر بلا أي تطبيع JS (بعد أن أخطأت أدواتي المطبَّعة بحذف الهمزة).
 * لكل نظام: الأسماء المطابِقة + عدد المواد الفعليّ.
 */
import { prisma } from "@/lib/prisma";

const PROBES: Array<{ label: string; like: string[] }> = [
  { label: "المعاملات المدنية", like: ["%معاملات المدنية%"] },
  { label: "المرافعات الشرعية", like: ["%مرافعات%"] },
  { label: "الإثبات", like: ["%الإثبات%", "%الاثبات%"] },
  { label: "الأحوال الشخصية", like: ["%الأحوال الشخصية%", "%الاحوال الشخصية%"] },
  { label: "الإجراءات الجزائية", like: ["%جراءات%", "%جزائ%", "%جنائ%"] },
  { label: "الشركات", like: ["%الشركات%"] },
  { label: "المحاكم التجارية", like: ["%المحاكم التجارية%"] },
  { label: "العمل", like: ["%نظام العمل%"] },
  { label: "الإفلاس", like: ["%إفلاس%", "%افلاس%"] },
  { label: "التوثيق", like: ["%التوثيق%"] },
  { label: "التحكيم", like: ["%التحكيم%"] },
];

async function main() {
  console.log("═".repeat(90));
  console.log("تحقّق خام (ILIKE مباشر، بلا تطبيع) — الأنظمة الأساسية");
  console.log("═".repeat(90));
  for (const p of PROBES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; c: bigint }>>(
      `SELECT s.id, s.name, count(a.id)::bigint AS c
       FROM legal_systems s
       LEFT JOIN legal_articles a ON a."legalSystemId" = s.id
       WHERE ${p.like.map((_, i) => `s.name ILIKE $${i + 1}`).join(" OR ")}
       GROUP BY s.id, s.name ORDER BY c DESC`,
      ...p.like
    );
    console.log(`\n▮ ${p.label} — ${rows.length} مطابقة`);
    for (const r of rows) console.log(`   • «${r.name}» — مواد=${Number(r.c)}`);
    if (!rows.length) console.log("   ❌ لا مطابقة خام.");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
