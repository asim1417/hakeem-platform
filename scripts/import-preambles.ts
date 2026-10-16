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

interface PreambleInput {
  lawName: string;
  preamble: string;
  royalDecree?: string | null;
  effectiveFrom?: string | null;
}

/** يقرأ المدخلات؛ يدعم حقل `file` (نصّ خامّ نسبةً لمجلد ملف JSON) لتفادي هروب النصوص الطويلة. */
async function parseEntries(raw: unknown, baseDir: string): Promise<PreambleInput[]> {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { preambles?: unknown[] })?.preambles) ? (raw as { preambles: unknown[] }).preambles : [];
  const out: PreambleInput[] = [];
  for (const r of arr) {
    const o = (r ?? {}) as Record<string, unknown>;
    const lawName = String(o.lawName ?? o.law_name ?? o.system ?? "").trim();
    let preamble = String(o.preamble ?? o.law_preamble ?? o.text ?? o.content ?? "").trim();
    if (!preamble && o.file) {
      preamble = (await fs.readFile(path.resolve(baseDir, String(o.file)), "utf8").catch(() => "")).trim();
    }
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

  const entries = await parseEntries(raw, path.dirname(file));
  if (!entries.length) {
    console.error("لا مدخلاتٍ صالحة (يلزم lawName + preamble/file لكلّ عنصر).");
    process.exit(1);
  }

  let imported = 0;
  const missing: string[] = [];
  for (const e of entries) {
    // مطابقة الاسم: حرفيّة ثمّ احتواء (فتُصيب ولو اختلفت تهجئة الاسم قليلًا في hoqoqi).
    let system = await prisma.legalSystem.findUnique({ where: { name: e.lawName } });
    if (!system) {
      system = await prisma.legalSystem.findFirst({ where: { name: { contains: e.lawName, mode: "insensitive" } } });
      if (system) console.log(`ℹ طابقتُ «${e.lawName}» بالنظام «${system.name}» (احتواء).`);
    }
    if (!system) {
      missing.push(e.lawName);
      continue;
    }
    const lawName = system.name;

    // الديباجة تُخزَّن حقلًا على مستوى النظام (لا «مادة صفر») — DATA-001 الخيار الثاني.
    const prevLen = system.preamble?.length ?? 0;
    if (prevLen) console.log(`  ↪ ديباجة سابقة: ${prevLen.toLocaleString("ar-SA")} حرفًا (ستُستبدل).`);

    const effectiveFrom = e.effectiveFrom ? new Date(e.effectiveFrom) : undefined;
    await prisma.legalSystem.update({
      where: { id: system.id },
      data: {
        preamble: e.preamble,
        preambleRoyalDecree: e.royalDecree ?? undefined,
        preambleEffectiveFrom: effectiveFrom && !Number.isNaN(effectiveFrom.getTime()) ? effectiveFrom : undefined,
        preambleUpdatedAt: new Date(),
      },
      select: { id: true },
    });

    imported += 1;
    console.log(`✓ ديباجة النظام: ${lawName} (${e.preamble.length.toLocaleString("ar-SA")} حرفًا).`);
  }

  console.log(`\nاكتمل: ${imported} ديباجة مستوردة (حقل preamble على مستوى النظام).`);
  if (missing.length) {
    console.warn(`\n⚠ أنظمةٌ لم تُوجَد بهذا الاسم في legal_systems (تُخطّت): \n - ${missing.join("\n - ")}`);
    console.warn("تأكّد أنّ lawName يطابق name في legal_systems حرفيًّا.");
  }
  await prisma.$disconnect();
}

void main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
