/**
 * اختبارات حارس الاستشهاد وحلّ اسم النظام (البند 1.1 من خطة الإصلاح).
 * التشغيل: npx tsx scripts/test-citation-guard.ts  (يتطلب قاعدة staging).
 * كل اختبار يعيد الحكم الصحيح أو CITATION_NOT_VERIFIED.
 */
import { PrismaClient } from "@prisma/client";
import { validateLegalCitation, CITATION_NOT_VERIFIED } from "../lib/modules/legal-core/legal-citation-guard";
import { resolveLaw, normalizeSystemName, isBylawName, isNumberingShifted } from "../lib/modules/legal-core/resolve-law";

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

    // ── قائمة إزاحة الترقيم (1.4) — وحدة ──
    ok(isNumberingShifted("نظام العمل") === true, "نظام العمل ضمن قائمة الإزاحة");
    ok(isNumberingShifted("نظام الشركات") === false, "نظام الشركات ليس ضمن قائمة الإزاحة");
    ok(isNumberingShifted("نظام المعاملات المدنية") === false, "المعاملات المدنية مُصحَّح (خارج القائمة)");

    // ── حلّ الاسم (قاعدة) ──
    const r1 = await resolveLaw("نظام الشركات");
    ok(r1.decisive === true && !!r1.system && r1.system.name.includes("الشركات"), "① مطابقة تامّة وحيدة حاسمة");

    const r2 = await resolveLaw("نظام الشركات ١٤٤٥هـ");
    ok(r2.decisive === true && !!r2.system, "② اسم بسنة ملتصقة يُحلّ حاسمًا بعد التطبيع");

    const r3 = await resolveLaw("الشركات");
    ok(r3.decisive === false && r3.matchType === "contains", "③ الاحتواء ليس حاسمًا (مرشّحون فقط)");

    // ── الحارس ──
    const g1 = await validateLegalCitation({ systemName: "نظام الشركات", articleNumber: 1 });
    ok(g1.ok === true && g1.inForce === false && g1.status.includes("قيد التحقق"), "④ بلا سجل تحقق ليست نافذة");

    const gAmbiguous = await validateLegalCitation({ systemName: "الشركات", articleNumber: 1 });
    ok(gAmbiguous.ok === false && (gAmbiguous as { code?: string }).code === CITATION_NOT_VERIFIED, "⑤ تطابق غير قاطع → CITATION_NOT_VERIFIED");

    const gRepealed = await validateLegalCitation({ systemName: "نظام المرافعات الشرعية", articleNumber: 212 });
    if (gRepealed.ok) ok(gRepealed.repealed === false && gRepealed.inForce === false, "⑥ بلا سجل تحقق لا تُوسَم ملغاة");
    else ok((gRepealed as { code?: string }).code === CITATION_NOT_VERIFIED, "⑥ المادة 212 غير محسومة → CITATION_NOT_VERIFIED");

    const g0 = await validateLegalCitation({ systemName: "نظام وهميّ لا وجود له", articleNumber: 1 });
    ok(g0.ok === false && (g0 as { code?: string }).code === CITATION_NOT_VERIFIED, "⑦ نظام غير موجود → CITATION_NOT_VERIFIED");

    console.log(failed === 0 ? "\n✓ نجحت اختبارات حارس الاستشهاد" : `\n✗ فشل ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
