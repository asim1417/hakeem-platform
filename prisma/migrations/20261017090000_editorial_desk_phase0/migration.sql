-- مكتب التحرير التشريعي — المرحلة صفر (W-01..W-05، W-07).
-- ترحيل إضافي فقط: جداول ودوال ومشغّلات جديدة. لا ALTER ولا DROP ولا UPDATE ولا DELETE على أي جدول قائم.
-- لا يُطبَّق على الإنتاج إلا باعتماد فردي من المالك (ف١٠)؛ لا مسار آلي يطبّقه (أمر البناء: prisma generate && next build).
-- التراجع (بعد اعتماد المالك وقبل أي استعمال): DROP TABLE index_sync, audit_event, review_decision, editorial_change, change_set;
--   DROP FUNCTION editorial_append_only(), editorial_guard_change(), editorial_guard_change_set();

-- ── دوال الحماية ─────────────────────────────────────────────────────────────

-- سجل لا يُعدَّل ولا يُحذف (W-04).
CREATE OR REPLACE FUNCTION editorial_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'الجدول % للإضافة فقط: لا تعديل ولا حذف', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- التغيير لا يُحذف، ولا يتغير منه بعد إنشائه إلا الحالة ونتيجة الفحوص.
CREATE OR REPLACE FUNCTION editorial_guard_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'editorial_change لا يُحذف' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.change_set_id, NEW.target_type, NEW.target_id, NEW.op, NEW.before, NEW.after,
      NEW.evidence_instrument, NEW.evidence_url, NEW.evidence_quote, NEW.source_rank, NEW.source_ref,
      NEW.read_at, NEW.author_id, NEW.author_kind, NEW.author_agent, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.change_set_id, OLD.target_type, OLD.target_id, OLD.op, OLD.before, OLD.after,
      OLD.evidence_instrument, OLD.evidence_url, OLD.evidence_quote, OLD.source_rank, OLD.source_ref,
      OLD.read_at, OLD.author_id, OLD.author_kind, OLD.author_agent, OLD.created_at) THEN
    RAISE EXCEPTION 'محتوى editorial_change ثابت بعد إنشائه؛ لا يتغير إلا status وchecks'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- الدفعة لا تُحذف، ولا يتغير منها إلا الحالة وتاريخ النشر.
CREATE OR REPLACE FUNCTION editorial_guard_change_set() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'change_set لا يُحذف' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.title, NEW.kind, NEW.author_id, NEW.author_kind, NEW.author_agent,
      NEW.reverts_change_set_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.title, OLD.kind, OLD.author_id, OLD.author_kind, OLD.author_agent,
      OLD.reverts_change_set_id, OLD.created_at) THEN
    RAISE EXCEPTION 'محتوى change_set ثابت بعد إنشائه؛ لا يتغير إلا status وpublished_at'
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
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "published_at" TIMESTAMPTZ,
  CHECK (("author_kind" = 'human' AND "author_id" IS NOT NULL)
      OR ("author_kind" = 'agent' AND "author_agent" IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS "change_set_status_idx" ON "change_set" ("status", "created_at" DESC);

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
  -- 1 أم القرى، 2 هيئة الخبراء، 3 الجهة المصدرة
  "source_rank" SMALLINT CHECK ("source_rank" IN (1, 2, 3)),
  -- مفتاح عدم التكرار للمقترح الوارد (D-02)، مثل uqn_fix.amendment_op:OP-0001
  "source_ref" TEXT,
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
  "decided_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- الاعتماد الذاتي لا يُقبل بلا سبب مكتوب (W-03)
  CHECK (NOT "self_approval" OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0))
);

CREATE INDEX IF NOT EXISTS "review_decision_set_idx" ON "review_decision" ("change_set_id", "decided_at" DESC);

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
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "index_sync_pending_idx" ON "index_sync" ("created_at" DESC)
  WHERE "search_norm_at" IS NULL OR "opensearch_at" IS NULL OR "page_revalidated_at" IS NULL;

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

CREATE OR REPLACE TRIGGER "change_set_guard"
  BEFORE UPDATE OR DELETE ON "change_set"
  FOR EACH ROW EXECUTE FUNCTION editorial_guard_change_set();
