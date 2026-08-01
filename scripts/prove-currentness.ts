// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §7 — إثبات سريان حزم المجال على النواة (Neon).
// لكلّ حزمة: يبحث عن أنظمتها الحاكمة في legal_systems، ويتحقّق أنّها ساريّة (لها مواد
// status='سارية')، ويأخذ تاريخ سريانها من مواد النظام. ثمّ:
//   - UPDATE jds_domain_packs.law_as_of_date = التاريخ المُثبَت (إن ثبت حاكمٌ ساري).
//   - INSERT لقطات سلطةٍ حقيقيّة في jds_authority_snapshots (idempotent).
// إن لم يُوجَد الحاكم ⇒ يبقى PENDING (لا اختلاق). يتطلّب DATABASE_URL.
//   AS_OF_DATE=YYYY-MM-DD npx tsx scripts/prove-currentness.ts
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import {
  ensureJudicialCoreSchema,
  seedDomainPacks,
  PACK_GOVERNING_SYSTEMS,
  resolvePackCurrentness,
  type GovSystemRecord,
} from "@/lib/modules/judicial";

function asOfDate(): string {
  const env = (process.env.AS_OF_DATE ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

// حالاتٌ تدلّ على أنّ المادّة/النظام لم يعد ساريًا (إلغاء/نسخ) — تُستبعَد من إثبات السريان.
// «needs_review» وسمٌ تحريريّ داخليّ (لا يعني الإلغاء)، فلا يُسقِط سريان النظام القائم.
const REPEALED_STATUSES = ["ملغاة", "ملغي", "مُلغاة", "ملغية", "منسوخة", "منسوخ", "معطلة"];

/** يجد الأنظمة الحاكمة المرشّحة في النواة، ويتحقّق من سريانها (وجودٌ بمواد غير ملغاة) وتاريخها. */
async function lookupGoverning(candidates: string[]): Promise<GovSystemRecord[]> {
  const out: GovSystemRecord[] = [];
  const seen = new Set<string>();
  for (const cand of candidates) {
    const systems = await prisma.legalSystem.findMany({
      where: { name: { contains: cand } },
      select: { id: true, name: true, articleCount: true },
      take: 5,
    });
    for (const s of systems) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      // ساري = نظامٌ قائمٌ (له مواد) وله مادّةٌ واحدة على الأقلّ غير ملغاة/منسوخة.
      // لا نشترط الوسم التحريريّ «سارية»: النواة تستورد أنظمةً سارية بحالة needs_review.
      const activeArticle = await prisma.legalArticle.findFirst({
        where: { lawName: s.name, status: { notIn: REPEALED_STATUSES } },
        select: { id: true },
      });
      // تاريخ السريان = أقدم effectiveFrom غير فارغ لمواد النظام (إن وُجد).
      const dated = await prisma.legalArticle.findFirst({
        where: { lawName: s.name, effectiveFrom: { not: null } },
        orderBy: { effectiveFrom: "asc" },
        select: { effectiveFrom: true },
      });
      out.push({
        name: s.name,
        active: Boolean(activeArticle) && s.articleCount > 0,
        effectiveFrom: dated?.effectiveFrom ? dated.effectiveFrom.toISOString().slice(0, 10) : null,
        systemId: s.id,
      });
    }
  }
  return out;
}

async function main() {
  const ok = await ensureJudicialCoreSchema();
  if (!ok) {
    console.error("تعذّر ضمان مخطّط JDS.");
    process.exit(1);
  }
  // ابذر الحزم أوّلًا (idempotent) كي توجد صفوفٌ لتحديث تاريخ سريانها.
  const seed = await seedDomainPacks();
  console.log(`بذر الحزم: ${seed.ok ? `${seed.upserted} حزمة` : `فشل (${seed.error})`}\n`);
  const date = asOfDate();
  console.log(`إثبات السريان — as-of ${date}\n`);

  let proven = 0;
  const pending: string[] = [];
  for (const packId of Object.keys(PACK_GOVERNING_SYSTEMS)) {
    const found = await lookupGoverning(PACK_GOVERNING_SYSTEMS[packId]);
    const res = resolvePackCurrentness(packId, date, found);

    if (res.proven) {
      // حدّث تاريخ السريان (الحزمة قد تكون مبذورةً؛ إن غابت لا نُنشئها هنا).
      await prisma.$executeRawUnsafe(
        `UPDATE "jds_domain_packs" SET "law_as_of_date" = $1, "updated_at" = NOW() WHERE "id" = $2`,
        res.lawAsOfDate,
        packId,
      );
      // لقطات سلطةٍ حقيقيّة (idempotent: احذف ثمّ أدخِل لكلّ نظامٍ حاكم).
      for (const snap of res.snapshots) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "jds_authority_snapshots" WHERE "system_name" = $1 AND "source_layer" = 'CURRENT_OFFICIAL_AUTHORITY'`,
          snap.systemName,
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "jds_authority_snapshots"
             ("source_layer","system_name","effective_from","law_as_of_date","currentness","verified_at")
           VALUES ('CURRENT_OFFICIAL_AUTHORITY',$1,$2,$3,'verified',NOW())`,
          snap.systemName,
          snap.effectiveFrom,
          res.lawAsOfDate,
        );
      }
      proven += 1;
      console.log(`✓ ${packId} — ساري (${res.governingFound.join("، ")}) → law_as_of_date=${res.lawAsOfDate}`);
    } else {
      pending.push(`${packId} (مفقود: ${res.missing.join("، ")})`);
      console.log(`… ${packId} — يبقى PENDING (لم يُثبت حاكمٌ ساري)`);
    }
  }

  console.log(`\nاكتمل: ${proven} حزمة مُثبَتة السريان.`);
  if (pending.length) console.log(`باقٍ PENDING:\n - ${pending.join("\n - ")}`);
  await prisma.$disconnect();
}

void main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
