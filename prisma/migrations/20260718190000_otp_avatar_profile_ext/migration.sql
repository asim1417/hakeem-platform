-- امتداد الملف: OTP جوال + صورة + شهادات (خارج Prisma عمدًا).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "certificates" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneOtpHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneOtpExpires" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastDailyVisit" DATE;
