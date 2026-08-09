/**
 * scripts/backfill/fetch-boe.ts — جلب أداة الإصدار والتمهيد من بوابة هيئة الخبراء
 * للأنظمة الناقصة (ثامنًا-٢). دفعات ≤ 20 مع مهلة مهذبة، وتخزين الخام أولًا.
 *
 * ⚠️⚠️ يحتاج شبكةً + خريطة روابط. laws.boe.gov.sa محجوب بسياسة الخروج في بيئة
 * الجلسة الحالية (403)، فيُشغَّل خارجها (جهاز/CI يصل للمصدر). لا يُدخِل على القاعدة
 * — يحفظ الخام فقط إلى data/backfill/boe-raw/. الاستخلاص والإدخال في ingest.ts.
 *
 * تشغيل (ببيئةٍ تصل للمصدر):
 *   npx tsx scripts/backfill/fetch-boe.ts            # معاينة
 *   npx tsx scripts/backfill/fetch-boe.ts --apply    # جلب فعليّ
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");
const BATCH = 20;
const DELAY_MS = 1500; // مهلة مهذبة بين الطلبات

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** يبني رابط البوابة للنظام — TODO: طابق مخطّط روابط البوابة الفعليّ لكل نظام. */
function boeUrlFor(system: { id: string; name: string; eliSlug?: string | null }): string | null {
  // إن خُزِّن sourceUrl سابقًا فاستعمله؛ وإلا فالبحث بالاسم/الـslug (يحتاج مخطّط البوابة).
  return system.eliSlug ? `https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/${encodeURIComponent(system.eliSlug)}` : null;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || /@localhost|@127\.0\.0\.1/.test(url)) {
    console.log("⏭️  تخطّي: لا DATABASE_URL حيّ — يلزم لتحديد الأنظمة الناقصة.");
    return;
  }

  // الأنظمة الناقصة: بلا وثيقة إصدار.
  const systems = await prisma.legalSystem.findMany({
    where: { documents: { none: { docType: { in: ["ROYAL_DECREE", "COUNCIL_DECISION", "AGENCY_DECISION"] } } } },
    select: { id: true, name: true, eliSlug: true },
    take: BATCH,
    orderBy: { name: "asc" },
  });

  console.log(`الدفعة: ${systems.length} نظامًا ناقصًا (حدّ ${BATCH}). apply=${APPLY}`);
  if (!APPLY) {
    for (const s of systems) console.log(`  - ${s.name} → ${boeUrlFor(s) ?? "لا رابط (يحتاج مخطّط البوابة)"}`);
    console.log("معاينة فقط. أعد بـ --apply للجلب الفعليّ (ببيئةٍ تصل للمصدر).");
    return;
  }

  mkdirSync("data/backfill/boe-raw", { recursive: true });
  let ok = 0;
  let skipped = 0;
  for (const s of systems) {
    const link = boeUrlFor(s);
    if (!link) { skipped++; console.log(`  ⚠️ لا رابط: ${s.name}`); continue; }
    try {
      const res = await fetch(link, { headers: { "user-agent": "hakeem-legal-agent/1.0" } });
      if (!res.ok) { skipped++; console.log(`  ✗ HTTP ${res.status}: ${s.name}`); continue; }
      const html = await res.text();
      writeFileSync(`data/backfill/boe-raw/${s.id}.html`, html, "utf-8");
      ok++;
      console.log(`  ✓ ${s.name}`);
    } catch (e) {
      skipped++;
      console.log(`  ✗ فشل الجلب: ${s.name} (${(e as Error).message})`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`تم: ${ok} | متخطّى: ${skipped}. الخام في data/backfill/boe-raw/.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
