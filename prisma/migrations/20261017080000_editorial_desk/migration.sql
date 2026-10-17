-- HKM-023. Additive only; apply this file alone to the isolated trial branch.
CREATE TABLE change_set (
 id text PRIMARY KEY, title text NOT NULL, kind text NOT NULL, author_id text NOT NULL,
 author_kind text NOT NULL CHECK (author_kind IN ('human','agent')),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','checks_failed','pending','approved','rejected','published','reverted')),
 payload_hash text NOT NULL, idempotency_key text NOT NULL UNIQUE,
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 reverts_change_set_id text REFERENCES change_set(id)
);
CREATE TABLE editorial_change (
 id text PRIMARY KEY, change_set_id text NOT NULL REFERENCES change_set(id),
 target_type text NOT NULL CHECK(target_type IN ('work','unit','ruling','relation','principle','amendment')),
 target_id text NOT NULL, domain text NOT NULL DEFAULT '', op text NOT NULL,
 before_json jsonb NOT NULL, after_json jsonb NOT NULL,
 evidence_instrument text NOT NULL, evidence_url text NOT NULL, evidence_quote text NOT NULL, source_rank integer NOT NULL,
 author_id text NOT NULL, author_kind text NOT NULL CHECK(author_kind IN ('human','agent')),
 status text NOT NULL DEFAULT 'draft', checks jsonb NOT NULL DEFAULT '[]',
 source_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX editorial_one_open_target ON editorial_change(target_type,target_id)
 WHERE status IN ('draft','checks_failed','pending','approved');
CREATE UNIQUE INDEX editorial_one_open_source ON editorial_change(evidence_url,source_hash)
 WHERE status IN ('draft','checks_failed','pending','approved');
CREATE INDEX editorial_change_set_idx ON editorial_change(change_set_id);
CREATE INDEX editorial_change_queue_idx ON editorial_change(status,created_at);
CREATE TABLE review_decision (
 id text PRIMARY KEY, change_set_id text NOT NULL REFERENCES change_set(id), reviewer_id text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approve','reject')), reason text NOT NULL,
 self_approval boolean NOT NULL DEFAULT false, payload_hash text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(change_set_id,reviewer_id)
);
CREATE TABLE audit_event (
 id bigserial PRIMARY KEY, actor_id text NOT NULL, actor_kind text NOT NULL, action text NOT NULL,
 change_set_id text REFERENCES change_set(id), target_id text, before_hash text, after_hash text,
 metadata jsonb NOT NULL DEFAULT '{}', session_id text NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_audit_time_idx ON audit_event(at,id);
CREATE TABLE editorial_config (
 revision serial PRIMARY KEY, data jsonb NOT NULL, actor_id text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE editorial_work_version (
 id text PRIMARY KEY, work_id text NOT NULL REFERENCES legal_systems(id), change_set_id text NOT NULL REFERENCES change_set(id),
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_work_version_latest ON editorial_work_version(work_id,created_at,id);
CREATE TABLE editorial_source_snapshot (
 id text PRIMARY KEY, source_url text NOT NULL, text_hash text NOT NULL, quote text NOT NULL,
 change_set_id text NOT NULL REFERENCES change_set(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(change_set_id,source_url,text_hash)
);
CREATE TABLE editorial_task (
 id text PRIMARY KEY, change_set_id text NOT NULL REFERENCES change_set(id), template_id text,
 title text NOT NULL, role_id text, assignee_id text, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','cancelled')),
 due_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_task_queue_idx ON editorial_task(status,due_at);
CREATE TABLE index_sync (
 id text PRIMARY KEY, change_set_id text NOT NULL REFERENCES change_set(id), target_type text NOT NULL, target_id text NOT NULL,
 search_norm_at timestamptz, opensearch_at timestamptz, revalidated_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz, lock_token text,
 last_error text, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(change_set_id,target_type,target_id)
);
CREATE INDEX index_sync_pending_idx ON index_sync(next_attempt_at) WHERE completed_at IS NULL;
CREATE FUNCTION editorial_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'editorial append-only record'; END;
$$;
CREATE TRIGGER editorial_audit_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION editorial_append_only();
CREATE TRIGGER editorial_decision_immutable BEFORE UPDATE OR DELETE ON review_decision FOR EACH ROW EXECUTE FUNCTION editorial_append_only();
CREATE TRIGGER editorial_config_immutable BEFORE UPDATE OR DELETE ON editorial_config FOR EACH ROW EXECUTE FUNCTION editorial_append_only();
CREATE TRIGGER editorial_work_version_immutable BEFORE UPDATE OR DELETE ON editorial_work_version FOR EACH ROW EXECUTE FUNCTION editorial_append_only();
CREATE TRIGGER editorial_source_immutable BEFORE UPDATE OR DELETE ON editorial_source_snapshot FOR EACH ROW EXECUTE FUNCTION editorial_append_only();
CREATE FUNCTION editorial_freeze_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.change_set_id IS DISTINCT FROM OLD.change_set_id OR NEW.target_id IS DISTINCT FROM OLD.target_id
 OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.op IS DISTINCT FROM OLD.op
 OR NEW.before_json IS DISTINCT FROM OLD.before_json OR NEW.after_json IS DISTINCT FROM OLD.after_json
 OR NEW.evidence_url IS DISTINCT FROM OLD.evidence_url OR NEW.evidence_quote IS DISTINCT FROM OLD.evidence_quote
 OR NEW.evidence_instrument IS DISTINCT FROM OLD.evidence_instrument OR NEW.author_id IS DISTINCT FROM OLD.author_id
 OR NEW.author_kind IS DISTINCT FROM OLD.author_kind OR NEW.domain IS DISTINCT FROM OLD.domain
 OR NEW.source_rank IS DISTINCT FROM OLD.source_rank OR NEW.source_hash IS DISTINCT FROM OLD.source_hash THEN
 RAISE EXCEPTION 'create a new change instead of editing an approved payload'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER editorial_change_freeze BEFORE UPDATE ON editorial_change FOR EACH ROW EXECUTE FUNCTION editorial_freeze_payload();
