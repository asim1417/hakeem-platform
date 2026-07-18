-- ملف شخصي + نقاط + إحالة — أعمدة/جداول خارج موديل Prisma عمدًا (مثل freeQuota).
-- IF NOT EXISTS: آمنة/متكرّرة. المستخدمون الحاليون = مكتملو onboarding.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "yearsExperience" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specialties" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "interests" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creditsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key" ON "users" ("referralCode");

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "credit_transactions_userId_idx" ON "credit_transactions" ("userId");
CREATE INDEX IF NOT EXISTS "credit_transactions_source_idx" ON "credit_transactions" ("userId", "source");

CREATE TABLE IF NOT EXISTS "referral_redemptions" (
  "id" TEXT PRIMARY KEY,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL UNIQUE,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "referral_redemptions_referrerId_idx" ON "referral_redemptions" ("referrerId");
