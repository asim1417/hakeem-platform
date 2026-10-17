-- مكتب التحرير التشريعي — المرحلة صفر (W-01..W-05، W-07)، موحّدًا مع أفكار #723 (HKM-023).
-- ترحيل إضافي فقط: جداول ودوال ومشغّلات جديدة. لا ALTER ولا DROP ولا UPDATE ولا DELETE على أي جدول قائم.
-- يُعاد تطبيقه بلا خطأ (IF NOT EXISTS وCREATE OR REPLACE).
-- لا يُطبَّق على الإنتاج إلا باعتماد فردي من المالك (ف١٠)؛ لا مسار آلي يطبّقه (أمر البناء: prisma generate && next build).
-- التراجع (بعد اعتماد المالك وقبل أي استعمال؛ مشغّلات TRUNCATE لا تمنع DROP):
--   DROP TABLE editorial_config, index_sync, audit_event, review_decision, editorial_change, change_set;
--   DROP FUNCTION editorial_append_only(), editorial_guard_change(), editorial_guard_change_set(), editorial_change_draft_only();

-- ── دوال الحماية ─────────────────────────────────────────────────────────────

-- سجل لا يُعدَّل ولا يُحذف ولا يُفرَّغ (W-04).
CREATE OR REPLACE FUNCTION editorial_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'الجدول % للإضافة فقط: لا تعديل ولا حذف ولا تفريغ', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- التغيير لا يُحذف، ولا يتغير منه بعد إنشائه إلا الحالة ونتيجة الفحوص،
-- ومرجع ما نشره (applied_ref) يُضبط مرة واحدة من NULL إلى قيمة.
CREATE OR REPLACE FUNCTION editorial_guard_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'editorial_change لا يُحذف' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.change_set_id, NEW.target_type, NEW.target_id, NEW.op, NEW.before, NEW.after,
      NEW.evidence_instrument, NEW.evidence_url, NEW.evidence_quote, NEW.source_rank, NEW.source_ref,
      NEW.domain, NEW.read_at, NEW.author_id, NEW.author_kind, NEW.author_agent, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.change_set_id, OLD.target_type, OLD.target_id, OLD.op, OLD.before, OLD.after,
      OLD.evidence_instrument, OLD.evidence_url, OLD.evidence_quote, OLD.source_rank, OLD.source_ref,
      OLD.domain, OLD.read_at, OLD.author_id, OLD.author_kind, OLD.author_agent, OLD.created_at) THEN
    RAISE EXCEPTION 'محتوى editorial_change ثابت بعد إنشائه؛ لا يتغير إلا status وchecks'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.applied_ref IS NOT NULL AND NEW.applied_ref IS DISTINCT FROM OLD.applied_ref THEN
    RAISE EXCEPTION 'applied_ref يُضبط مرة واحدة عند النشر ولا يتغير بعدها'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- الدفعة لا تُحذف، ولا يتغير منها إلا الحالة وتاريخ النشر؛
-- وبصمة الحمولة (payload_hash) تُضبط عند الإرسال مرة واحدة ثم تُجمَّد.
CREATE OR REPLACE FUNCTION editorial_guard_change_set() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'change_set لا يُحذف' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.title, NEW.kind, NEW.author_id, NEW.author_kind, NEW.author_agent,
      NEW.reverts_change_set_id, NEW.idempotency_key, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.title, OLD.kind, OLD.author_id, OLD.author_kind, OLD.author_agent,
      OLD.reverts_change_set_id, OLD.idempotency_key, OLD.created_at) THEN
    RAISE EXCEPTION 'محتوى change_set ثابت بعد إنشائه؛ لا يتغير إلا status وpublished_at'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.payload_hash IS NOT NULL AND NEW.payload_hash IS DISTINCT FROM OLD.payload_hash THEN
    RAISE EXCEPTION 'بصمة حمولة الدفعة مجمّدة بعد ضبطها'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- لا يُدرج تغيير إلا في دفعة مسودة (ق-٨): لا تُضاف حمولة إلى دفعة أُرسلت أو اعتُمدت.
-- FOR SHARE يسلسل الإدراج مع قلب حالة الدفعة في معاملة أخرى.
CREATE OR REPLACE FUNCTION editorial_change_draft_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  set_status TEXT;
BEGIN
  SELECT status INTO set_status FROM change_set WHERE id = NEW.change_set_id FOR SHARE;
  IF set_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'لا يُدرج تغيير إلا في دفعة مسودة (حالة الدفعة: %)', coalesce(set_status, 'غير موجودة')
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- ── الدفعات والتغييرات ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "change_set" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('manual', 'agent_review', 'agent_review_bulk', 'revert', 'emergency_revert')),
  "author_id" TEXT REFERENCES "users"("id"),
  "author_kind" TEXT NOT NULL CHECK ("author_kind" IN ('human', 'agent')),
  "author_agent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft', 'checks_failed', 'pending', 'approved', 'rejected', 'published', 'reverted')),
  "reverts_change_set_id" TEXT REFERENCES "change_set"("id"),
  -- بصمة حمولة التغييرات، تُحسب من الصفوف عند الإرسال وتُعاد عند القرار والنشر (ق-٦).
  "payload_hash" TEXT,
  -- مفتاح تكرار الطلب (اختياري).
  "idempotency_key" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "published_at" TIMESTAMPTZ,
  CHECK (("author_kind" = 'human' AND "author_id" IS NOT NULL)
      OR ("author_kind" = 'agent' AND "author_agent" IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS "change_set_status_idx" ON "change_set" ("status", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "change_set_idempotency_uq" ON "change_set" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "editorial_change" (
  "id" TEXT PRIMARY KEY,
  "change_set_id" TEXT NOT NULL REFERENCES "change_set"("id"),
  "target_type" TEXT NOT NULL
    CHECK ("target_type" IN ('work', 'unit', 'ruling', 'relation', 'principle', 'amendment_op')),
  "target_id" TEXT NOT NULL,
  "op" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "evidence_instrument" TEXT,
  "evidence_url" TEXT,
  "evidence_quote" TEXT,
  -- 1 أم القرى، 2 هيئة الخبراء، 3 الجهة المصدرة (مشتق من الرابط في الخادم، لا من العميل)
  "source_rank" SMALLINT CHECK ("source_rank" IN (1, 2, 3)),
  -- مفتاح عدم التكرار للمقترح الوارد (D-02)، مثل uqn_fix.amendment_op:OP-0001
  "source_ref" TEXT,
  -- مجال النظام المستهدف وقت الإنشاء (نطاق التكليف، ق-٥)؛ '' لما لا مجال له (عناصر الاستقبال).
  "domain" TEXT NOT NULL DEFAULT '',
  -- مرجع ما كتبه النشر في المصدر (verification.id لحالة النظام)؛ التراجع يرفض إن لم يعد هو الحالي (ق-٧).
  "applied_ref" TEXT,
  -- وقت قراءة المُعِدّ للهدف؛ أي سجل أحدث منه للهدف نفسه = تعارض (W-02)
  "read_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "author_id" TEXT REFERENCES "users"("id"),
  "author_kind" TEXT NOT NULL CHECK ("author_kind" IN ('human', 'agent')),
  "author_agent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft', 'checks_failed', 'pending', 'approved', 'rejected', 'published', 'reverted')),
  "checks" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (("author_kind" = 'human' AND "author_id" IS NOT NULL)
      OR ("author_kind" = 'agent' AND "author_agent" IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS "editorial_change_set_idx" ON "editorial_change" ("change_set_id");
CREATE INDEX IF NOT EXISTS "editorial_change_target_idx" ON "editorial_change" ("target_type", "target_id", "created_at" DESC);

-- قفل الهدف (D-03): تغيير مفتوح واحد على الهدف نفسه.
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_change_open_target_uq"
  ON "editorial_change" ("target_type", "target_id")
  WHERE "status" IN ('draft', 'checks_failed', 'pending', 'approved');

-- عدم التكرار (D-02): المقترح الوارد الواحد لا يُنشئ إلا تغييرًا واحدًا ما لم يُتراجع عنه أو يُرفض قبل النشر.
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_change_source_ref_uq"
  ON "editorial_change" ("source_ref")
  WHERE "source_ref" IS NOT NULL AND "status" NOT IN ('rejected', 'reverted');

CREATE TABLE IF NOT EXISTS "review_decision" (
  "id" TEXT PRIMARY KEY,
  "change_set_id" TEXT NOT NULL REFERENCES "change_set"("id"),
  "reviewer_id" TEXT NOT NULL REFERENCES "users"("id"),
  "decision" TEXT NOT NULL CHECK ("decision" IN ('approve', 'reject')),
  "reason" TEXT,
  "self_approval" BOOLEAN NOT NULL DEFAULT FALSE,
  -- بصمة الحمولة التي قرّر عليها المعتمِد؛ لا تُعدّ الموافقة إلا إن طابقت بصمة الدفعة (ق-٦).
  "payload_hash" TEXT NOT NULL,
  "decided_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- الاعتماد الذاتي لا يُقبل بلا سبب مكتوب (W-03)
  CHECK (NOT "self_approval" OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
);

CREATE INDEX IF NOT EXISTS "review_decision_set_idx" ON "review_decision" ("change_set_id", "decided_at" DESC);
-- قرار واحد لكل معتمِد في الدفعة الواحدة (تعدد الموافقات = معتمِدون مختلفون).
CREATE UNIQUE INDEX IF NOT EXISTS "review_decision_set_reviewer_uq" ON "review_decision" ("change_set_id", "reviewer_id");

-- ── سجل التدقيق (W-04) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_event" (
  "id" BIGSERIAL PRIMARY KEY,
  "actor_id" TEXT,
  "actor_kind" TEXT NOT NULL CHECK ("actor_kind" IN ('human', 'agent', 'system')),
  "action" TEXT NOT NULL,
  "object_type" TEXT NOT NULL,
  "object_id" TEXT NOT NULL,
  "before_hash" TEXT,
  "after_hash" TEXT,
  "session_id" TEXT,
  "detail" JSONB,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_event_at_idx" ON "audit_event" ("at" DESC);
CREATE INDEX IF NOT EXISTS "audit_event_object_idx" ON "audit_event" ("object_type", "object_id", "at" DESC);
CREATE INDEX IF NOT EXISTS "audit_event_actor_idx" ON "audit_event" ("actor_id", "at" DESC);

-- ── مزامنة الفهارس بعد النشر (S-01) ──────────────────────────────────────────
-- أعمدة الطابور (outbox) تُضاف الآن تجنّبًا لـ ALTER بعد التطبيق؛ المنفّذ والمجدول في المرحلة الأولى (ق-١٣).

CREATE TABLE IF NOT EXISTS "index_sync" (
  "id" TEXT PRIMARY KEY,
  "change_set_id" TEXT NOT NULL REFERENCES "change_set"("id"),
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "search_norm_at" TIMESTAMPTZ,
  "opensearch_at" TIMESTAMPTZ,
  "vectors_at" TIMESTAMPTZ,
  "page_revalidated_at" TIMESTAMPTZ,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "locked_until" TIMESTAMPTZ,
  "lock_token" TEXT,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "index_sync_pending_idx" ON "index_sync" ("created_at" DESC)
  WHERE "search_norm_at" IS NULL OR "opensearch_at" IS NULL OR "page_revalidated_at" IS NULL;
CREATE INDEX IF NOT EXISTS "index_sync_due_idx" ON "index_sync" ("next_attempt_at") WHERE "completed_at" IS NULL;
-- صف مزامنة واحد لكل هدف في الدفعة الواحدة.
CREATE UNIQUE INDEX IF NOT EXISTS "index_sync_target_uq" ON "index_sync" ("change_set_id", "target_type", "target_id");

-- ── إعدادات المكتب (ق-٢، ق-٤، ق-٥) ───────────────────────────────────────────
-- نسخ إلحاقية: كل حفظ صف جديد برقم نسخة يلي السابق، بسبب ومنفّذ. آخر نسخة هي السارية.

CREATE TABLE IF NOT EXISTS "editorial_config" (
  "version" INTEGER PRIMARY KEY CHECK ("version" >= 1),
  "config" JSONB NOT NULL,
  "reason" TEXT NOT NULL CHECK (length(btrim("reason")) >= 5),
  "actor_id" TEXT NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── المشغّلات (على الجداول الجديدة وحدها) ────────────────────────────────────

CREATE OR REPLACE TRIGGER "audit_event_append_only"
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "audit_event_no_truncate"
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "review_decision_append_only"
  BEFORE UPDATE OR DELETE ON "review_decision"
  FOR EACH ROW EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "review_decision_no_truncate"
  BEFORE TRUNCATE ON "review_decision"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "editorial_change_guard"
  BEFORE UPDATE OR DELETE ON "editorial_change"
  FOR EACH ROW EXECUTE FUNCTION editorial_guard_change();

CREATE OR REPLACE TRIGGER "editorial_change_draft_only"
  BEFORE INSERT ON "editorial_change"
  FOR EACH ROW EXECUTE FUNCTION editorial_change_draft_only();

CREATE OR REPLACE TRIGGER "editorial_change_no_truncate"
  BEFORE TRUNCATE ON "editorial_change"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "change_set_guard"
  BEFORE UPDATE OR DELETE ON "change_set"
  FOR EACH ROW EXECUTE FUNCTION editorial_guard_change_set();

CREATE OR REPLACE TRIGGER "change_set_no_truncate"
  BEFORE TRUNCATE ON "change_set"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "index_sync_no_truncate"
  BEFORE TRUNCATE ON "index_sync"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "editorial_config_append_only"
  BEFORE UPDATE OR DELETE ON "editorial_config"
  FOR EACH ROW EXECUTE FUNCTION editorial_append_only();

CREATE OR REPLACE TRIGGER "editorial_config_no_truncate"
  BEFORE TRUNCATE ON "editorial_config"
  FOR EACH STATEMENT EXECUTE FUNCTION editorial_append_only();
