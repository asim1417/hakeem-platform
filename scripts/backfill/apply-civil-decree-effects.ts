/**
 * apply-civil-decree-effects — يسجّل الآثار النظامية لمرسوم نظام المعاملات المدنية
 * (م/191) على الأنظمة الأخرى في جدول article_amendments، بحالة needs_review فقط.
 *
 * المصدر: data/backfill/civil-decree-effects.json (حزمة HAKEEM-PREAMBLE-CIV-001،
 * الشواهد مستخرجة حرفيًّا من منطوق المرسوم، provenance + raw_sha256).
 *
 * السلوك الآمن (وفق تحذير المصدر «يلزم تأكيد بشريّ قبل الاعتماد»):
 *   • لا يغيّر نصّ أي مادة، ولا حالتها (status)، ولا يحذف شيئًا.
 *   • يضيف صفوف article_amendments بحالة reviewStatus=needs_review فقط (لم تُعتمد بعد).
 *   • idempotent: لا يكرّر أثرًا سُجِّل سابقًا لنفس المادة (وسم effect_id في summary).
 *   • E8 (حكم انتقالي على النظام كاملًا) لا يُسجَّل كتعديل مادة — مُغطّى في ديباجة النظام.
 *
 * الأمان: dry-run افتراضيًّا؛ على Neon يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const SRC = "data/backfill/civil-decree-effects.json";
const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));

function mapChangeType(effectType: string): "repealed" | "amended" {
  if (effectType.includes("إلغاء")) return "repealed";
  return "amended"; // تعديل بالإحلال
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const effects: any[] = pkg.legal_effects || [];
  const decreeRef = pkg.law?.decree ? `${pkg.law.decree} وتاريخ ${pkg.law.decree_date_h}هـ` : "م/191 وتاريخ 1444/11/29هـ";
  const prisma = new PrismaClient();
  if (isNeon && process.argv.includes("--apply") && !APPLY) {
    console.error("🛑 Neon (إنتاج): الكتابة تتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.");
    process.exit(2);
  }

  const plan: Array<{ effect: string; law: string; num: number; type: string; action: string }> = [];
  let recorded = 0, skipped = 0, missing = 0;

  try {
    for (const e of effects) {
      if (e.effect_type === "حكم انتقالي") { plan.push({ effect: e.effect_id, law: e.target_law, num: 0, type: e.effect_type, action: "skip(system-level→preamble)" }); continue; }
      const nums: number[] = Array.isArray(e.target_articles) && e.target_articles.length ? e.target_articles : [];
      for (const num of nums) {
        const art = await prisma.legalArticle.findFirst({
          where: { lawName: e.target_law, articleNumber: num },
          select: { id: true },
        });
        if (!art) { missing++; plan.push({ effect: e.effect_id, law: e.target_law, num, type: e.effect_type, action: "MISSING" }); continue; }

        const tag = `[${e.effect_id}]`;
        const already = await prisma.articleAmendment.findFirst({
          where: { articleId: art.id, summary: { startsWith: tag } },
          select: { id: true },
        });
        if (already) { skipped++; plan.push({ effect: e.effect_id, law: e.target_law, num, type: e.effect_type, action: "exists" }); continue; }

        if (APPLY) {
          const count = await prisma.articleAmendment.count({ where: { articleId: art.id } });
          await prisma.articleAmendment.create({
            data: {
              articleId: art.id,
              version: count + 1,
              changeType: mapChangeType(e.effect_type),
              decreeRef,
              hijriDate: pkg.law?.decree_date_h ?? "1444/11/29",
              summary: `${tag} ${e.effect_type} — ${String(e.evidence_quote || "").slice(0, 400)}`,
              previousText: e.repealed_text ?? null,
              newText: e.new_text ?? null,
              source: "import",
              reviewStatus: "needs_review",
            },
          });
          recorded++;
        }
        plan.push({ effect: e.effect_id, law: e.target_law, num, type: e.effect_type, action: APPLY ? "recorded" : "would-record" });
      }
    }

    console.log(`${APPLY ? "🛠️ APPLY" : "🔎 DRY-RUN"} — آثار مرسوم ${decreeRef}`);
    for (const p of plan) console.log(`  ${p.effect} ${p.type.padEnd(14)} ${p.law.slice(0, 40).padEnd(40)} م${p.num || "-"} → ${p.action}`);
    console.log(`\nالمجموع: مُسجَّل=${recorded} موجود=${skipped} مفقود=${missing} (needs_review — لم يُعتمد، لا تغيير على النصّ أو الحالة)`);
    if (!APPLY) console.log("ℹ️  DRY-RUN: لم تُكتب بيانات.");
    else console.log("✓ سُجِّلت الآثار بحالة needs_review. المراجعة البشرية ثمّ قرار تحديث status للمواد الملغاة لاحقًا.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
