import "server-only";

// ضمان جدول أرشيف نسخ أداة الوثائق وقت إقلاع الخادم (idempotent) — نفس نمط
// ensureBlueprintSchema/ensureConversationSessionSchema القائم. كل عبارة إضافيّة بحتة
// (IF NOT EXISTS / DO block) فلا كسر مهما تكرّرت أو سبقت/تأخّرت عن نشر الكود. يجعل
// الجدول يُنشأ تلقائيًّا عند أوّل إقلاعٍ بعد النشر — بلا خطوة migration يدويّة.

import { prisma } from "@/lib/prisma";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "doc_tool_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "actor_id" TEXT,
    "docs" JSONB NOT NULL,
    "doc_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_tool_snapshots_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "doc_tool_snapshots_workspace_id_created_at_idx"
    ON "doc_tool_snapshots" ("workspace_id", "created_at")`,
  `DO $$ BEGIN
    ALTER TABLE "doc_tool_snapshots"
      ADD CONSTRAINT "doc_tool_snapshots_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "doc_workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

/** يطبّق عبارات إنشاء جدول الأرشيف تباعًا؛ دفاعيّ لكل عبارة فلا يوقف الإقلاع. */
export async function ensureDocToolSnapshotSchema(): Promise<boolean> {
  let ok = true;
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      ok = false;
      console.warn("[doc-tool.schema] تخطّي عبارة:", (e as Error)?.message?.split("\n")[0]);
    }
  }
  return ok;
}
