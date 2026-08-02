-- منظومة الفوترة الأساسية — HKM-BILLING-UX-001 (المرحلة 0).
-- إضافية بالكامل وآمنة/متكرّرة (IF NOT EXISTS + DO blocks). لا حذف/إعادة تسمية.
-- مطابقة لـ lib/modules/billing/ensure-billing-schema.ts (آلية الإنشاء عند الإقلاع).

-- ── أنواع enum ──
DO $$ BEGIN CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY','YEARLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING','ACTIVE','PAST_DUE','PAYMENT_RETRY','CANCELED','EXPIRED','PAUSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrderType" AS ENUM ('SUBSCRIPTION_NEW','SUBSCRIPTION_RENEWAL','SUBSCRIPTION_UPGRADE','SUBSCRIPTION_DOWNGRADE','POINTS_PACKAGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('PENDING','AWAITING_PAYMENT','PAID','FAILED','CANCELED','REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED','PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE','EXPIRED','REMOVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceType" AS ENUM ('TAX_INVOICE','SIMPLIFIED_TAX_INVOICE','CREDIT_NOTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED','CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RefundStatus" AS ENUM ('PENDING','SUCCEEDED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED','PROCESSED','FAILED','DUPLICATE','DEAD_LETTER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ZatcaStatus" AS ENUM ('NOT_APPLICABLE','PENDING','REPORTED','CLEARED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── قيمة enum جديدة على AuditSubject ──
ALTER TYPE "AuditSubject" ADD VALUE IF NOT EXISTS 'BILLING';

-- ── الجداول ──
CREATE TABLE IF NOT EXISTS "billing_plans" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "monthly_points" INTEGER NOT NULL DEFAULT 0,
  "included_seats" INTEGER NOT NULL DEFAULT 1,
  "entitlements" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_plan_prices" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "billing_period" "BillingPeriod" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "subtotal_halalas" INTEGER NOT NULL,
  "vat_halalas" INTEGER NOT NULL,
  "total_halalas" INTEGER NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_plan_prices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_workspaces" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_workspaces_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_workspace_members" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_workspace_members_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "workspace_id" TEXT,
  "plan_id" TEXT NOT NULL,
  "provider" TEXT,
  "provider_subscription_id" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMP(3),
  "trial_ends_at" TIMESTAMP(3),
  "payment_method_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_orders" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "workspace_id" TEXT,
  "subscription_id" TEXT,
  "type" "OrderType" NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "subtotal_halalas" INTEGER NOT NULL,
  "vat_halalas" INTEGER NOT NULL,
  "total_halalas" INTEGER NOT NULL,
  "plan_id" TEXT,
  "points_package_code" TEXT,
  "points_granted" INTEGER,
  "idempotency_key" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_payments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_payment_id" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
  "amount_halalas" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "payment_method_type" TEXT,
  "provider_fee_halalas" INTEGER,
  "paid_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "failure_message" TEXT,
  "raw_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_payment_methods" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_customer_id" TEXT,
  "provider_token" TEXT,
  "brand" TEXT,
  "network" TEXT,
  "last_four" TEXT,
  "expiry_month" INTEGER,
  "expiry_year" INTEGER,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" "PaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payment_methods_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "type" "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
  "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "subtotal_halalas" INTEGER NOT NULL,
  "vat_rate_bps" INTEGER NOT NULL,
  "vat_halalas" INTEGER NOT NULL,
  "total_halalas" INTEGER NOT NULL,
  "seller_snapshot" JSONB NOT NULL,
  "buyer_snapshot" JSONB NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdf_url" TEXT,
  "xml_url" TEXT,
  "zatca_status" "ZatcaStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_refunds" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "provider_refund_id" TEXT,
  "amount_halalas" INTEGER NOT NULL,
  "reason" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "points_reversed" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_refunds_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT,
  "signature_verified" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processing_error" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_audit_logs" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "billing_model_prices" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'anthropic',
  "model" TEXT NOT NULL,
  "input_usd_per_million" DOUBLE PRECISION NOT NULL,
  "output_usd_per_million" DOUBLE PRECISION NOT NULL,
  "cache_write_usd_per_million" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cache_read_usd_per_million" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "web_search_usd_per_request" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_model_prices_pkey" PRIMARY KEY ("id")
);

-- ── الفهارس ──
CREATE UNIQUE INDEX IF NOT EXISTS "billing_plans_code_key" ON "billing_plans"("code");
CREATE INDEX IF NOT EXISTS "billing_plan_prices_plan_id_billing_period_is_active_idx" ON "billing_plan_prices"("plan_id","billing_period","is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_workspace_members_workspace_id_user_id_key" ON "billing_workspace_members"("workspace_id","user_id");
CREATE INDEX IF NOT EXISTS "billing_subscriptions_user_id_status_idx" ON "billing_subscriptions"("user_id","status");
CREATE INDEX IF NOT EXISTS "billing_subscriptions_status_current_period_end_idx" ON "billing_subscriptions"("status","current_period_end");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_orders_idempotency_key_key" ON "billing_orders"("idempotency_key");
CREATE INDEX IF NOT EXISTS "billing_orders_user_id_status_idx" ON "billing_orders"("user_id","status");
CREATE INDEX IF NOT EXISTS "billing_payments_provider_provider_payment_id_idx" ON "billing_payments"("provider","provider_payment_id");
CREATE INDEX IF NOT EXISTS "billing_payment_methods_user_id_is_default_idx" ON "billing_payment_methods"("user_id","is_default");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_invoice_number_key" ON "billing_invoices"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_order_id_key" ON "billing_invoices"("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_events_provider_provider_event_id_key" ON "billing_webhook_events"("provider","provider_event_id");
CREATE INDEX IF NOT EXISTS "billing_audit_logs_action_created_at_idx" ON "billing_audit_logs"("action","created_at");
CREATE INDEX IF NOT EXISTS "billing_model_prices_provider_model_is_active_idx" ON "billing_model_prices"("provider","model","is_active");

-- ── المفاتيح الأجنبية ──
DO $$ BEGIN ALTER TABLE "billing_plan_prices" ADD CONSTRAINT "billing_plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_workspaces" ADD CONSTRAINT "billing_workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_workspace_members" ADD CONSTRAINT "billing_workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "billing_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_workspace_members" ADD CONSTRAINT "billing_workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "billing_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "billing_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── طبقة Buckets فوق محرك وحدات v2 ──
CREATE TABLE IF NOT EXISTS "usage_credit_buckets" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('TRIAL','SUBSCRIPTION','PURCHASE','PROMOTION','REFUND','ADMIN_GRANT','LEGACY_MIGRATION')),
  "sourceReferenceId" TEXT,
  "grantedMilliUnits" BIGINT NOT NULL CHECK ("grantedMilliUnits" >= 0),
  "remainingMilliUnits" BIGINT NOT NULL CHECK ("remainingMilliUnits" >= 0),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','depleted','expired','revoked')),
  "startsAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("remainingMilliUnits" <= "grantedMilliUnits")
);
CREATE INDEX IF NOT EXISTS "usage_credit_buckets_consume_idx" ON "usage_credit_buckets" ("userId","status","expiresAt","priority");
CREATE INDEX IF NOT EXISTS "usage_credit_buckets_source_idx" ON "usage_credit_buckets" ("sourceType","sourceReferenceId");

-- ── عدّاد ترقيم الفواتير المتسلسل ──
CREATE TABLE IF NOT EXISTS "billing_invoice_counters" (
  "year" INTEGER PRIMARY KEY,
  "last_seq" INTEGER NOT NULL DEFAULT 0
);

-- ── توسعة جداول v2 (IF EXISTS: لا يكسر إن لم تُطبَّق هجرة usage_credits_v2 بعد) ──
ALTER TABLE IF EXISTS "usage_credit_ledger" ADD COLUMN IF NOT EXISTS "bucketId" TEXT;
ALTER TABLE IF EXISTS "usage_credit_ledger" ADD COLUMN IF NOT EXISTS "serviceCode" TEXT;
ALTER TABLE IF EXISTS "usage_credit_ledger" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE IF EXISTS "usage_credit_ledger" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE IF EXISTS "usage_service_prices" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS "usage_service_prices" ADD COLUMN IF NOT EXISTS "displayNameAr" TEXT;
ALTER TABLE IF EXISTS "usage_service_prices" ADD COLUMN IF NOT EXISTS "displayNameEn" TEXT;
ALTER TABLE IF EXISTS "usage_service_prices" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS "usage_service_prices" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMPTZ;
