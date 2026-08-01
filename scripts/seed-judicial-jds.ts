// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 PR2 — بذر جداول JDS على القاعدة الحيّة (idempotent).
// يُنشئ الجداول (ensure-schema) ثمّ يبذر حزم المجال. يتطلّب DATABASE_URL.
//   npm run db:jds
// ─────────────────────────────────────────────────────────────────────────────
import { ensureJudicialCoreSchema, seedDomainPacks, JDS_TABLES } from "@/lib/modules/judicial";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("JDS: ضمان المخطّط…");
  const ensured = await ensureJudicialCoreSchema();
  console.log(ensured ? `✓ جداول JDS جاهزة (${JDS_TABLES.length})` : "✗ تعذّر إنشاء المخطّط");
  if (!ensured) process.exit(1);

  console.log("JDS: بذر حزم المجال…");
  const res = await seedDomainPacks();
  console.log(res.ok ? `✓ بُذرت ${res.upserted} حزمة مجال` : `✗ فشل البذر: ${res.error}`);

  await prisma.$disconnect();
  if (!res.ok) process.exit(1);
}

void main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
