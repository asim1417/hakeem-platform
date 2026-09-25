/**
 * db-ensure-schema — أمر إداري صريح يشغّل تجهيزات المخطط idempotent التي كانت
 * تُنفَّذ خطأً عند كل إقلاع (RUN-001). يُشغَّل يدويًّا ضمن نافذة صيانة/ترحيل مراجَعة:
 *
 *   npm run db:ensure-schema
 *
 * ⚠️ ينفّذ DDL (ALTER/CREATE IF NOT EXISTS). **لا يُشغَّل على الإنتاج إلا بموافقة صريحة**
 * ووفق DB_RUNBOOK.md. لا يعيد كتابة كلمة مرور أي مستخدم قائم.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const log = (m: string) => console.log(m);
  try {
    if (!apply) {
      log("🔎 DRY-RUN: لن يُنفَّذ أي DDL. أضف --apply للتنفيذ (بعد موافقة + نسخة احتياطية).");
    }

    // ① عمود clerk_id + username (كان في instrumentation).
    if (apply) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key" ON "users" ("clerk_id")`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT`);
      log("✓ users.clerk_id / username جاهزة.");
    } else log("• users.clerk_id / username (idempotent DDL)");

    // ② تجهيزات المخطط الإضافية (كانت في instrumentation).
    const steps: Array<[string, () => Promise<unknown>]> = [
      ["conversations", async () => (await import("@/lib/modules/conversations/ensure-schema")).ensureConversationSessionSchema()],
      ["ai-usage", async () => (await import("@/lib/modules/billing/ai-usage-meter")).ensureAiUsageSchema()],
      ["blueprint", async () => (await import("@/lib/modules/observability/ensure-blueprint-schema")).ensureBlueprintSchema()],
      ["doc-tool", async () => (await import("@/lib/modules/doc-tool/ensure-schema")).ensureDocToolSnapshotSchema()],
    ];
    for (const [name, fn] of steps) {
      if (!apply) { log(`• ${name} (idempotent DDL)`); continue; }
      try { await fn(); log(`✓ ${name} جاهز.`); }
      catch (e) { console.warn(`⚠️ ${name}: ${(e as Error)?.message}`); }
    }

    log(apply ? "\n✓ اكتملت تجهيزات المخطط." : "\nℹ️  معاينة فقط.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
