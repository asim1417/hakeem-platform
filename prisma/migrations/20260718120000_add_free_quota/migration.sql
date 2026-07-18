-- حصّة الاستخدام المجانيّة — أعمدة على users (خارج موديل Prisma عمدًا؛ القراءة/الكتابة SQL خام).
-- IF NOT EXISTS: آمنة/متكرّرة، ولا تكسر إن طُبّقت مسبقًا.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "freeQuotaUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "freeQuotaTotal" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'free';
