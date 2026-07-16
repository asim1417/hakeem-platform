// ─────────────────────────────────────────────────────────────────────────────
// سكربت وسم المعيار (المرحلة ١.ب) — يملأ أعمدة norm_* على legal_articles.
// لكل مادة غير مُوسَّمة: يحاول النموذج (callCentralProvider) لاستخراج {addressee, modality,
// condition, effect}؛ وعند غياب المزوّد أو فشل التحقّق → سقوطٌ حتميّ إلى inferNormative.
// آمن لإعادة التشغيل (يتخطّى المُوسَّم). لا يُشغَّل تلقائيًّا — يدويًّا/عبر CI بعد الهجرة.
//   الاستخدام:  tsx scripts/tag-normative.ts [--limit N] [--dry] [--rules-only]
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { inferNormative, isValidModality, type NormativeTag } from "@/lib/modules/agents/substrate/normative";

const argv = process.argv.slice(2);
const LIMIT = Number(argv.find((a) => a.startsWith("--limit"))?.split("=")[1] ?? (argv.includes("--limit") ? argv[argv.indexOf("--limit") + 1] : "")) || 0;
const DRY = argv.includes("--dry");
const RULES_ONLY = argv.includes("--rules-only");

const SYSTEM = [
  "أنت مُصنِّف قانونيّ. صنّف نصّ المادة النظامية إلى JSON فقط بالشكل:",
  '{"addressee": "المخاطَب أو null", "modality": "إلزام|إباحة|حظر|رخصة_تقديرية", "condition": "الشرط أو null", "effect": "الأثر أو null"}',
  "modality واحدة من الأربع حصرًا. رخصة_تقديرية حين يُخوَّل القاضي/المحكمة تقديرًا. لا تكتب شيئًا خارج JSON.",
].join(" ");

async function classifyWithModel(text: string): Promise<NormativeTag | null> {
  const res = await callCentralProvider({ systemPrompt: SYSTEM, userPrompt: text.slice(0, 1600), maxTokens: 300 }).catch(() => null);
  if (!res || res.mode !== "server" || !res.content) return null;
  try {
    const m = res.content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const modality = isValidModality(j.modality) ? j.modality : undefined;
    if (!modality) return null; // نموذج بلا modality صالحة → نترك السقوط الحتميّ
    return {
      addressee: typeof j.addressee === "string" && j.addressee !== "null" ? j.addressee.slice(0, 120) : undefined,
      modality,
      condition: typeof j.condition === "string" && j.condition !== "null" ? j.condition.slice(0, 400) : undefined,
      effect: typeof j.effect === "string" && j.effect !== "null" ? j.effect.slice(0, 400) : undefined,
      source: "model",
    };
  } catch {
    return null;
  }
}

// أعمدة norm_* خارج موديل Prisma عمدًا (تفادي كسر ما لم تُطبَّق الهجرة) → قراءة/كتابة بـSQL خام.
async function countUntagged(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM legal_articles WHERE "norm_modality" IS NULL`
  );
  return Number(rows[0]?.c ?? 0);
}
async function fetchUntagged(limit: number): Promise<Array<{ id: string; content: string }>> {
  return prisma.$queryRawUnsafe<Array<{ id: string; content: string }>>(
    `SELECT id, content FROM legal_articles WHERE "norm_modality" IS NULL ORDER BY id ASC LIMIT ${limit}`
  );
}
async function writeTag(id: string, tag: NormativeTag): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE legal_articles
       SET "norm_addressee" = $2, "norm_modality" = $3, "norm_condition" = $4, "norm_effect" = $5, "norm_source" = $6
     WHERE id = $1`,
    id,
    tag.addressee ?? null,
    tag.modality ?? "غير_مصنّف", // غير null كي لا يُعاد اختياره لانهائيًّا
    tag.condition ?? null,
    tag.effect ?? null,
    tag.source
  );
}

async function main() {
  const total = await countUntagged().catch((e) => {
    console.error("تعذّر العدّ (هل طُبِّقت الهجرة؟):", (e as Error).message);
    return 0;
  });
  const take = LIMIT > 0 ? LIMIT : total;
  console.log(`مواد غير مُوسَّمة: ${total.toLocaleString("ar-SA")} · سنعالج: ${take.toLocaleString("ar-SA")}${DRY ? " (تجريبي)" : ""}${RULES_ONLY ? " (قواعد فقط)" : ""}`);

  const batchSize = 200;
  let processed = 0,
    modelTagged = 0,
    ruleTagged = 0;
  while (processed < take) {
    const rows = await fetchUntagged(Math.min(batchSize, take - processed));
    if (!rows.length) break;
    for (const r of rows) {
      let tag: NormativeTag | null = RULES_ONLY ? null : await classifyWithModel(r.content);
      if (tag) modelTagged += 1;
      if (!tag) {
        tag = inferNormative(r.content);
        ruleTagged += 1;
      }
      if (!DRY) await writeTag(r.id, tag).catch(() => {});
      processed += 1;
    }
    console.log(`… ${processed.toLocaleString("ar-SA")}/${take.toLocaleString("ar-SA")} (نموذج ${modelTagged} · قواعد ${ruleTagged})`);
    if (DRY) break; // في التجريبي دفعة واحدة تكفي للمعاينة
  }
  console.log(`اكتمل: ${processed.toLocaleString("ar-SA")} مادة (نموذج ${modelTagged} · قواعد ${ruleTagged}).`);
  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
