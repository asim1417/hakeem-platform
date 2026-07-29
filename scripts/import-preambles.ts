// ─────────────────────────────────────────────────────────────────────────────
// استيراد ديباجات الأنظمة إلى النواة — تُخزَّن **مادّةً رقمها صفر** (articleNumber = 0)
// بعنوان «الديباجة»، فتركب خطّ الأنابيب القائم (بحث + تضمين + استشهاد) بلا هجرة سكيمة.
//
// الاستعمال:
//   npx tsx scripts/import-preambles.ts [مسار ملف JSON]   (افتراضيّ: data/preambles.json)
//
// صيغة الملف: مصفوفةٌ من { lawName, preamble, royalDecree?, effectiveFrom? }.
//   lawName يجب أن يطابق اسم النظام في legal_systems حرفيًّا.
//
// بعد الاستيراد: شغّل تضمين المتجهات كي تصبح الديباجة قابلةً للبحث الدلاليّ:
//   npx tsx scripts/backfill-embeddings-table.ts
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { PREAMBLE_ARTICLE_NUMBER, PREAMBLE_TITLE } from "@/lib/modules/legal-core/article-ref";

interface PreambleInput {
  lawName: string;
  preamble: string;
  royalDecree?: string | null;
  effectiveFrom?: string | null;
}

function parseEntries(raw: unknown): PreambleInput[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { preambles?: unknown[] })?.preambles) ? (raw as { preambles: unknown[] }).preambles : [];
  const out: PreambleInput[] = [];
  for (const r of arr) {
    const o = (r ?? {}) as Record<string, unknown>;
    const lawName = String(o.lawName ?? o.law_name ?? o.system ?? "").trim();
    const preamble = String(o.preamble ?? o.law_preamble ?? o.text ?? o.content ?? "").trim();
    if (!lawName || !preamble) continue;
    out.push({
      lawName,
      preamble,
      royalDecree: o.royalDecree ? String(o.royalDecree) : null,
      effectiveFrom: o.effectiveFrom ? String(o.effectiveFrom) : null,
    });
  }
  return out;
}

async function main() {
  const file = path.resolve(process.argv[2] || "data/preambles.json");
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    console.error(`تعذّر قراءة ملف الديباجات: ${file}\n${e instanceof Error ? e.message : e}`);
    console.error("أنشئ الملف بصيغة: [{ \"lawName\": \"…\", \"preamble\": \"…\" }] — انظر data/preambles.example.json");
    process.exit(1);
  }

  const entries = parseEntries(raw);
  if (!entries.length) {
    console.error("لا مدخلاتٍ صالحة (يلزم lawName + preamble لكلّ عنصر).");
    process.exit(1);
  }

  let imported = 0;
  const missing: string[] = [];
  for (const e of entries) {
    const system = await prisma.legalSystem.findUnique({ where: { name: e.lawName } });
    if (!system) {
      missing.push(e.lawName);
      continue;
    }
    const effectiveFrom = e.effectiveFrom ? new Date(e.effectiveFrom) : undefined;
    const data = {
      legalSystemId: system.id,
      title: PREAMBLE_TITLE,
      content: e.preamble,
      status: "سارية",
      royalDecree: e.royalDecree ?? undefined,
      effectiveFrom: effectiveFrom && !Number.isNaN(effectiveFrom.getTime()) ? effectiveFrom : undefined,
    };
    await prisma.legalArticle.upsert({
      where: { lawName_articleNumber: { lawName: e.lawName, articleNumber: PREAMBLE_ARTICLE_NUMBER } },
      update: data,
      create: { lawName: e.lawName, articleNumber: PREAMBLE_ARTICLE_NUMBER, ...data },
    });
    imported += 1;
    console.log(`✓ ديباجة: ${e.lawName} (${e.preamble.length.toLocaleString("ar-SA")} حرفًا)`);
  }

  console.log(`\nاكتمل: ${imported} ديباجة مستوردة (مادّة رقم ${PREAMBLE_ARTICLE_NUMBER}).`);
  if (missing.length) {
    console.warn(`\n⚠ أنظمةٌ لم تُوجَد بهذا الاسم في legal_systems (تُخطّت): \n - ${missing.join("\n - ")}`);
    console.warn("تأكّد أنّ lawName يطابق name في legal_systems حرفيًّا.");
  }
  if (imported) {
    console.log("\nالخطوة التالية (لجعلها قابلةً للبحث الدلاليّ): npx tsx scripts/backfill-embeddings-table.ts");
  }
  await prisma.$disconnect();
}

void main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
