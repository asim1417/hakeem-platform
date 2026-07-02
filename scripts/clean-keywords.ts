/**
 * clean-keywords.ts — تنظيف حقل legal_articles.keywords من **ميتاداتا الاستيراد** المُسرَّبة
 * (source:hoqoqi_sql · review:needs_review · article:… · *_sql · hoqoqi) التي لوّثت الكلمات
 * المفتاحية لمواد hoqoqi. هذه ليست كلمات عربية مميِّزة، بل ثنائيات key:value تُشوّش الاسترجاع
 * (الكلمات تغذّي البحث) وتُلوّث العرض والقياس (كشفها قياس العنصر المعروف).
 *
 * محافظ: يُسقط فقط العناصر التي تطابق بصمة الميتاداتا (ASCII key: أو hoqoqi/_sql/needs_review).
 * يُبقي كلّ كلمة عربية مشروعة، ويُزيل الفراغات والتكرار. **حيادي دلاليًا** لبقية النظام.
 *
 * افتراضيًا **تجربة جافّة (قراءة فقط)**: يعدّ ويُعايِن دون كتابة. الكتابة تحتاج --apply
 * وبوّابة CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED (عبر workflow مُقفل فقط).
 *
 * التشغيل:  npm run clean:keywords            # تجربة جافّة (تقرير)
 *           npm run clean:keywords -- --apply  # كتابة (مُبوَّبة)
 */
import { prisma } from "@/lib/prisma";

const BATCH = 300;

// بصمة ميتاداتا الاستيراد: ثنائية «مفتاح‎:‎» لاتينية، أو رموز استيراد معروفة.
const META_KEY = /(?:^|\s)(?:source|review|article|status|id|page|sourceid|sourcepageid|created|updated)\s*:/i;
function isJunkKeyword(k: string): boolean {
  const t = (k ?? "").trim();
  if (!t) return true; // فارغ → يُزال
  return META_KEY.test(t) || /hoqoqi/i.test(t) || /needs_review/i.test(t) || /_sql\b/i.test(t);
}

/** يعيد الكلمات النظيفة (مقلَّمة، بلا ميتاداتا، بلا فراغ، بلا تكرار مع حفظ الترتيب). */
function cleanKeywords(keywords: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of keywords ?? []) {
    const t = (raw ?? "").trim();
    if (!t || isJunkKeyword(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function assertAlignmentConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error(
      "✗ الكتابة مقفولة. مصدر الحقيقة وقت التشغيل هو Neon. اضبط " +
        "CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED بعد مواءمة DATABASE_URL مع Neon عمداً."
    );
    process.exit(1);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (apply) assertAlignmentConfirmed();

  console.log("═".repeat(72));
  console.log(`تنظيف keywords من ميتاداتا الاستيراد — ${apply ? "كتابة (مُبوَّبة)" : "تجربة جافّة (قراءة فقط)"}`);
  console.log("═".repeat(72));

  let cursor = "";
  let scanned = 0;
  let affected = 0;
  let tokensRemoved = 0;
  let emptied = 0;
  let updated = 0;
  const samples: Array<{ id: string; before: number; afterList: string[] }> = [];

  for (;;) {
    const rows = await prisma.legalArticle.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, keywords: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    const pending: Array<{ id: string; cleaned: string[] }> = [];
    for (const r of rows) {
      const before = r.keywords ?? [];
      const cleaned = cleanKeywords(before);
      if (cleaned.length === before.length && cleaned.every((v, i) => v === before[i])) continue; // بلا تغيير
      affected += 1;
      tokensRemoved += before.length - cleaned.length;
      if (cleaned.length === 0 && before.length > 0) emptied += 1;
      if (samples.length < 15) samples.push({ id: r.id, before: before.length, afterList: cleaned.slice(0, 6) });
      pending.push({ id: r.id, cleaned });
    }

    if (apply && pending.length) {
      await Promise.all(
        pending.map((p) =>
          prisma.legalArticle
            .update({ where: { id: p.id }, data: { keywords: p.cleaned } })
            .then(() => {
              updated += 1;
            })
            .catch(() => {
              /* تجاهل صفّاً واحداً فاشلاً دون كسر الدفعة */
            })
        )
      );
    }
    if (scanned % 3000 === 0) console.log(`… مسح ${scanned.toLocaleString("en-US")} · متأثّر ${affected.toLocaleString("en-US")}`);
  }

  console.log("\n" + "─".repeat(72));
  console.log(`مسح: ${scanned.toLocaleString("en-US")} مادة`);
  console.log(`مواد متأثّرة (بها ميتاداتا/فراغ/تكرار): ${affected.toLocaleString("en-US")}`);
  console.log(`عناصر مُزالة إجمالاً: ${tokensRemoved.toLocaleString("en-US")}`);
  console.log(`مواد ستصبح keywords فيها فارغة (كانت كلّها ميتاداتا): ${emptied.toLocaleString("en-US")}`);
  if (samples.length) {
    console.log("\nعيّنة (المعرّف · عدد قبل → أمثلة بعد):");
    for (const s of samples) {
      console.log(`  ${s.id.slice(0, 10)}… · ${s.before} → [${s.afterList.join("، ") || "—"}]`);
    }
  }
  if (apply) {
    console.log(`\n✓ اكتملت الكتابة. مُحدَّث: ${updated.toLocaleString("en-US")} مادة.`);
  } else {
    console.log(`\nℹ تجربة جافّة — لا كتابة. للتطبيق: --apply عبر workflow مُقفل (CONFIRM_RUNTIME_DB_ALIGNMENT).`);
  }
  console.log("═".repeat(72));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("✗ فشل clean-keywords:", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
