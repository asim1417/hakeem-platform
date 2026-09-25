/**
 * adopt-decree-effects — اعتماد آثار مرسوم م/191 بعد المراجعة: يضع وسمًا على المواد
 * المتأثرة **دون حذف نصّها**.
 *   • الإلغاء الكامل (effect_type = «إلغاء») → status = «ملغاة» (النصّ يبقى كما هو، يُعرض بوسم أحمر).
 *   • الإلغاء الجزئي / التعديل بالإحلال → status يبقى «سارية»؛ الوسم يأتي من سجل التعديل.
 *   • يضبط reviewStatus = «verified» على تعديلات هذه الحزمة (اعتُمدت بموافقة بشرية).
 * لا يحذف أي نصّ. idempotent. dry-run افتراضيًّا؛ على Neon يتطلّب البوابات الثلاث.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const SRC = "data/backfill/civil-decree-effects.json";
const REPEALED_STATUS = "ملغاة";
const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));

async function main() {
  const pkg = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const effects: any[] = pkg.legal_effects || [];
  const prisma = new PrismaClient();
  if (isNeon && process.argv.includes("--apply") && !APPLY) {
    console.error("🛑 Neon (إنتاج): الكتابة تتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.");
    process.exit(2);
  }
  let repealedSet = 0, verified = 0;
  const rows: string[] = [];
  try {
    for (const e of effects) {
      if (e.effect_type === "حكم انتقالي") continue;
      const fullRepeal = e.effect_type === "إلغاء";
      for (const num of e.target_articles || []) {
        const art = await prisma.legalArticle.findFirst({ where: { lawName: e.target_law, articleNumber: num }, select: { id: true, status: true } });
        if (!art) { rows.push(`${e.effect_id} م${num} ${e.target_law} → MISSING`); continue; }
        // اعتماد التعديل المسجَّل.
        if (APPLY) {
          const upd = await prisma.articleAmendment.updateMany({ where: { articleId: art.id, summary: { startsWith: `[${e.effect_id}]` } }, data: { reviewStatus: "verified" } });
          verified += upd.count;
        }
        // الإلغاء الكامل فقط يغيّر الحالة (بلا مسّ النصّ).
        if (fullRepeal) {
          if (APPLY && art.status !== REPEALED_STATUS) {
            await prisma.legalArticle.update({ where: { id: art.id }, data: { status: REPEALED_STATUS }, select: { id: true } });
            repealedSet++;
          }
          rows.push(`${e.effect_id} م${num} ${e.target_law} → status=${REPEALED_STATUS}`);
        } else {
          rows.push(`${e.effect_id} م${num} ${e.target_law} → وسم تعديل (status يبقى سارية)`);
        }
      }
    }
    console.log(`${APPLY ? "🛠️ APPLY" : "🔎 DRY-RUN"} — اعتماد آثار م/191 (بلا حذف نصّ)`);
    rows.forEach((r) => console.log("  " + r));
    console.log(`\nمواد وُضِع عليها status=ملغاة: ${repealedSet} · تعديلات اعتُمدت (verified): ${verified}`);
    if (!APPLY) console.log("ℹ️  DRY-RUN: لم تُكتب بيانات.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
