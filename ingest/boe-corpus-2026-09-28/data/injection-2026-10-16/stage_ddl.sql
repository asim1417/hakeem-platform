CREATE SCHEMA IF NOT EXISTS boe_inject;
CREATE TABLE IF NOT EXISTS boe_inject.verification_stage (id text PRIMARY KEY, object_type text, object_id text, verified_status text, evidence_instrument text, evidence_url text, evidence_quote text, method text, verified_by text, staged_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS boe_inject.unit_version_stage (id text PRIMARY KEY, unit_id text, body text, valid_from text, evidence_instrument text, evidence_url text, evidence_quote text, staged_at timestamptz DEFAULT now());
