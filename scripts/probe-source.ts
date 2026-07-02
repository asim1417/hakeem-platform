/**
 * probe-source.ts — محاولة الوصول إلى المصدر الأصلي (sjp.moj.gov.sa) من شبكة مُشغّل CI
 * (تختلف عن بروكسي بيئة التطوير الذي يحجب النطاق). الهدف: هل يمكن قراءة نصّ الحكم من المصدر
 * لتصحيح الكلمات العربية↔العربية الملتصقة؟ يُبلّغ بصدق: حالة HTTP، نوع المحتوى، وهل النصّ
 * موجود أم صفحة JS فارغة أم محجوب.
 *
 * قراءة فقط على القاعدة (يجلب sourceLink للأحكام الملتصقة فعلاً)، ثم fetch للمصدر.
 * التشغيل عبر workflow. متغيّرات: PROBE_N=8
 */
import { prisma } from "@/lib/prisma";

const N = Number(process.env.PROBE_N || 8);
// حروف عربية بلا تطويل(0640) وبلا أرقام — لكشف الالتصاق العربي↔العربي الحقيقي.
const AR_LETTERS = /[ء-ؿف-يٮ-ۓەۮۯۺ-ۿ]/;
function longestGenuineArabicRun(s: string): number {
  let max = 0, cur = 0;
  for (const ch of s) {
    if (AR_LETTERS.test(ch)) { cur += 1; if (cur > max) max = cur; }
    else cur = 0;
  }
  return max;
}

async function probe(url: string): Promise<string> {
  const clean = url.replace("//Filter", "/Filter");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(clean, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.8",
      },
    }).catch((e) => { throw e; });
    clearTimeout(t);
    const body = await res.text().catch(() => "");
    const ct = res.headers.get("content-type") || "";
    const hasArabic = /[ء-ي]{20,}/.test(body);
    const looksSpa = /<div id="app"|__NUXT__|__NEXT_DATA__|ng-version|<app-root/.test(body) && !hasArabic;
    return `HTTP ${res.status} · ${ct} · ${body.length}B · عربي=${hasArabic ? "نعم" : "لا"} · SPA=${looksSpa ? "نعم" : "لا"}`;
  } catch (e) {
    return `تعذّر: ${e instanceof Error ? e.message.slice(0, 80) : "خطأ"}`;
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("مسبار المصدر الأصلي (sjp.moj.gov.sa) من شبكة مُشغّل CI — قراءة فقط");
  console.log("=".repeat(80));

  const picked: Array<{ id: string; sourceLink: string | null }> = [];
  let cursor = "";
  outer: for (;;) {
    const rows = await prisma.judicialCase.findMany({
      where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: 1000,
      select: { id: true, sourceLink: true, judgmentText: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) {
      if (longestGenuineArabicRun(r.judgmentText ?? "") > 28) {
        picked.push({ id: r.id, sourceLink: r.sourceLink });
        if (picked.length >= N) break outer;
      }
    }
  }

  console.log(`أحكام بالتصاق عربي↔عربي حقيقي (عيّنة ${picked.length}):\n`);
  for (const p of picked) {
    const status = p.sourceLink ? await probe(p.sourceLink) : "لا رابط مصدر";
    console.log(`• ${p.id}`);
    console.log(`    ${p.sourceLink ?? "—"}`);
    console.log(`    ${status}`);
  }
  console.log("\nالخلاصة: إن ظهر «عربي=نعم» فالمصدر يحمل النصّ ويمكن قراءته لتصحيح الملتصق؛");
  console.log("إن «SPA=نعم» فالصفحة تحتاج متصفّحًا (Playwright)؛ إن «تعذّر/403» فالمصدر محجوب حتى من CI.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("x فشل مسبار المصدر:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
