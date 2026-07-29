-- وحدات الاستخدام v2 — إضافة محافظة فوق نقاط الولاء والحصّة القديمة.
-- لا حذف ولا إعادة تسمية. التفعيل يبدأ false عبر feature_toggles.

CREATE TABLE IF NOT EXISTS "usage_credit_accounts" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "balanceMilliUnits" BIGINT NOT NULL DEFAULT 0 CHECK ("balanceMilliUnits" >= 0),
  "reservedMilliUnits" BIGINT NOT NULL DEFAULT 0 CHECK ("reservedMilliUnits" >= 0),
  "lifetimeCreditMilliUnits" BIGINT NOT NULL DEFAULT 0,
  "lifetimeDebitMilliUnits" BIGINT NOT NULL DEFAULT 0,
  "version" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("reservedMilliUnits" <= "balanceMilliUnits")
);

CREATE TABLE IF NOT EXISTS "usage_credit_ledger" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "entryType" TEXT NOT NULL CHECK ("entryType" IN ('credit','debit','reversal','adjustment')),
  "amountMilliUnits" BIGINT NOT NULL,
  "balanceAfterMilliUnits" BIGINT NOT NULL,
  "source" TEXT NOT NULL,
  "description" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "previousHash" TEXT,
  "entryHash" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "usage_credit_ledger_user_created_idx"
  ON "usage_credit_ledger" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "usage_credit_ledger_reference_idx"
  ON "usage_credit_ledger" ("referenceType", "referenceId");

CREATE TABLE IF NOT EXISTS "usage_credit_reservations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "serviceCode" TEXT NOT NULL,
  "estimatedMilliUnits" BIGINT NOT NULL CHECK ("estimatedMilliUnits" > 0),
  "capturedMilliUnits" BIGINT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'held' CHECK ("status" IN ('held','captured','released','expired')),
  "referenceId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "usage_credit_reservations_user_status_idx"
  ON "usage_credit_reservations" ("userId", "status");
CREATE INDEX IF NOT EXISTS "usage_credit_reservations_expiry_idx"
  ON "usage_credit_reservations" ("expiresAt", "status");

CREATE TABLE IF NOT EXISTS "usage_service_prices" (
  "serviceCode" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "pricingModel" TEXT NOT NULL,
  "milliUnits" BIGINT NOT NULL CHECK ("milliUnits" >= 0),
  "unitSize" INTEGER NOT NULL DEFAULT 1 CHECK ("unitSize" > 0),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "usage_credit_packages" (
  "code" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "unitsMilli" BIGINT NOT NULL CHECK ("unitsMilli" > 0),
  "priceHalalas" INTEGER NOT NULL CHECK ("priceHalalas" >= 0),
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "active" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "usage_credit_quotas" (
  "key" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "limitMilliUnits" BIGINT NOT NULL,
  "period" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;
ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMPTZ;
ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "firstUseAt" TIMESTAMPTZ;
ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMPTZ;
ALTER TABLE "referral_redemptions" ADD COLUMN IF NOT EXISTS "firstPurchaseAt" TIMESTAMPTZ;

INSERT INTO "feature_toggles" ("id", "key", "enabled", "createdAt")
VALUES ('usage-credits-v2', 'usage_credits_v2', false, NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "usage_service_prices"
  ("serviceCode","name","pricingModel","milliUnits","unitSize")
VALUES
  ('ASK_HAKEEM','اسأل حكيم','TOKEN_WEIGHTED',1000,1000),
  ('CONSULTATION','الاستشارات','TOKEN_WEIGHTED',1000,1000),
  ('SIMULATION','القاضي التفاعلي','FIXED',1000,1),
  ('DOCUMENT_UPLOAD','رفع المستند','FIXED',250,1),
  ('OCR_PAGE','OCR للصفحة','PER_PAGE',250,1),
  ('OCR_COMPLEX_TABLE','جدول معقد','PER_TABLE',500,1),
  ('INDEX_TOKENS','فهرسة كل 1000 توكن','PER_TOKEN_BLOCK',100,1000),
  ('HYBRID_SEARCH','البحث الهجين','FIXED',250,1),
  ('RERANK','إعادة الترتيب','FIXED',250,1)
ON CONFLICT ("serviceCode") DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_usage_credit_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'usage_credit_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS usage_credit_ledger_no_mutation ON "usage_credit_ledger";
CREATE TRIGGER usage_credit_ledger_no_mutation
BEFORE UPDATE OR DELETE ON "usage_credit_ledger"
FOR EACH ROW EXECUTE FUNCTION prevent_usage_credit_ledger_mutation();
