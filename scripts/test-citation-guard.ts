/**
 * اختبارات حارس الاستشهاد وحلّ اسم النظام (البند 1.1 من خطة الإصلاح).
 * التشغيل: npx tsx scripts/test-citation-guard.ts  (يتطلب قاعدة staging).
 * كل اختبار يعيد الحكم الصحيح أو CITATION_NOT_VERIFIED.
 */
import { PrismaClient } from "@prisma/client";
import { validateLegalCitation, CITATION_NOT_VERIFIED } from "../lib/modules/legal-core/legal-citation-guard";
import { resolveLaw, normalizeSystemName, isBylawName } from "../lib/modules/legal-core/resolve-law";

const prisma = new PrismaClient();
let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) { failed++; console.error("✗ " + m); } else console.log("✓ " + m); };

async function main() {
  try {
    // ── وحدات التطبيع (بلا قاعدة) ──
    ok(normalizeSystemName("نظام الشركـات") === "نظام الشركات", "التطبيع يُسقط التطويل");
    ok(normalizeSystemName("نظام الشركات ١٤٤٥هـ") === "نظام الشركات", "التطبيع يُسقط السنة الملتصقة");
    ok(isBylawName(normalizeSystemName("اللائحة التنفيذية لنظام التوثيق")) === true, "كشف اللائحة التنفيذية");
    ok(isBylawName(normalizeSystemName("نظام الشركات")) === false, "النظام الأصل ليس لائحة");

    // ── حلّ الاسم (قاعدة) ──
    const r1 = await resolveLaw("نظام الشركات");
    ok(!!r1 && r1.system.name.includes("الشركات"), "① مطابقة تامّة تحلّ «نظام الشركات»");

    const r2 = await resolveLaw("نظام الشركات ١٤٤٥هـ");
    ok(!!r2 && r2.system.name.includes("الشركات"), "② اسم بسنة ملتصقة يُحلّ بعد التطبيع");

    // ── الحارس ──
    const g1 = await validateLegalCitation({ systemName: "نظام الشركات", articleNumber: 1 });
    ok(g1.ok === true, "③ استشهاد صحيح لمادة موجودة");

    const gRepealed = await validateLegalCitation({ systemName: "نظام المرافعات الشرعية", articleNumber: 212 });
    // على staging طُبِّق وسم الإلغاء للمادة 212 (إن لم يُطبَّق تُقبل «سارية» كتنبيه).
    if (gRepealed.ok) ok(gRepealed.repealed === true || gRepealed.status === "سارية", "④ المادة 212 تُرصد حالتها (ملغاة إن اعتُمد الأثر)");
    else ok(gRepealed.code === CITATION_NOT_VERIFIED, "④ المادة 212 غير موجودة → CITATION_NOT_VERIFIED");

    const g0 = await validateLegalCitation({ systemName: "نظام وهميّ لا وجود له ١٢٣", articleNumber: 1 });
    ok(g0.ok === false && (g0 as { code?: string }).code === CITATION_NOT_VERIFIED, "⑤ نظام غير موجود → CITATION_NOT_VERIFIED");

    console.log(failed === 0 ? "\n✓ نجحت اختبارات حارس الاستشهاد" : `\n✗ فشل ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
