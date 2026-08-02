-- إنشاء جدول أرشيف نسخ أداة الوثائق (doc_tool_snapshots).
-- جدولٌ إضافيّ صرف لا يمسّ أيّ جدولٍ قائم — آمنٌ وقابلٌ لإعادة التشغيل (idempotent).
--
-- طرق التشغيل (اختر واحدة، من بيئةٍ متّصلة بقاعدة الإنتاج):
--   • من خادمٍ متّصل: npx prisma db execute --file prisma/sql/doc_tool_snapshots.sql --schema prisma/schema.prisma
--   • أو مباشرةً:      psql "$DATABASE_URL" -f prisma/sql/doc_tool_snapshots.sql
--
-- بديلٌ وفق عُرف المستودع (يُزامن كلّ النماذج الإضافيّة المعلّقة، لا هذا الجدول وحده):
--   npx prisma db push
--
-- الكود fail-open: قبل تشغيل هذا، تعمل الأداة كالمعتاد والأرشفة صامتة (لا تعطّل).

CREATE TABLE IF NOT EXISTS "doc_tool_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "actor_id" TEXT,
    "docs" JSONB NOT NULL,
    "doc_count" INTEGER NOT NULL DEFAULT 0,
    "content_hash" TEXT,
    "byte_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_tool_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "doc_tool_snapshots" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
ALTER TABLE "doc_tool_snapshots" ADD COLUMN IF NOT EXISTS "byte_size" INTEGER;

CREATE INDEX IF NOT EXISTS "doc_tool_snapshots_workspace_id_created_at_idx"
    ON "doc_tool_snapshots"("workspace_id", "created_at");

-- المفتاح الأجنبيّ (idempotent عبر DO block — لا يفشل إن كان موجودًا):
DO $$ BEGIN
    ALTER TABLE "doc_tool_snapshots"
        ADD CONSTRAINT "doc_tool_snapshots_workspace_id_fkey"
        FOREIGN KEY ("workspace_id") REFERENCES "doc_workspaces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
