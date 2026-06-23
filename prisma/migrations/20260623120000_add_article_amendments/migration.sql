-- حوكمة قانونية: تتبّع التعديلات والإصدارات التاريخية للمادة.
-- إضافية بالكامل: جدول جديد فقط، لا تعديل ولا حذف لأي جدول قائم.
-- آمنة لإعادة التشغيل (IF NOT EXISTS).

-- CreateTable
CREATE TABLE IF NOT EXISTS "article_amendments" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeType" TEXT NOT NULL DEFAULT 'amended',
    "decreeRef" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "hijriDate" TEXT,
    "summary" TEXT,
    "previousText" TEXT,
    "newText" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "article_amendments_articleId_version_key" ON "article_amendments"("articleId", "version");
CREATE INDEX IF NOT EXISTS "article_amendments_articleId_idx" ON "article_amendments"("articleId");
CREATE INDEX IF NOT EXISTS "article_amendments_effectiveFrom_idx" ON "article_amendments"("effectiveFrom");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "article_amendments" ADD CONSTRAINT "article_amendments_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "legal_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
