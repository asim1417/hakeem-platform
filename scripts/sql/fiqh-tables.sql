-- ════════════════════════════════════════════════════════════════════════
-- جداول المسائل القانونية (fiqh_issues / fiqh_issue_links) — SQL إضافي آمن.
-- يطابق نموذجي Prisma FiqhIssue/FiqhIssueLink. آمن للتكرار (IF NOT EXISTS).
-- بلا مساس بالجداول الأصلية. ربط منطقي بالمواد عبر (law_name, article_number).
--
-- الغرض: تطبيق الجداول على بيئات مُقفلة (مثل Neon) دون `prisma db push`
-- (الذي قد يُسقط فهارس trigram/pgvector المُدارة خارج Prisma). راجع docs/db-governance.md.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "fiqh_issues" (
  "id"                 TEXT PRIMARY KEY,            -- = issueId الثابت (fiqh-<sha1>)
  "title"              TEXT NOT NULL,
  "path"               TEXT NOT NULL,
  "section"            TEXT NOT NULL,
  "book"               TEXT,
  "chapter"            TEXT,
  "node_type"          TEXT NOT NULL,
  "suggested_nizam"    TEXT NOT NULL,
  "link_status"        TEXT NOT NULL,
  "nizam_ratio"        DOUBLE PRECISION NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'candidate',
  "needs_human_review" BOOLEAN NOT NULL DEFAULT true,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_fiqh_issues_link_status" ON "fiqh_issues" ("link_status");
CREATE INDEX IF NOT EXISTS "idx_fiqh_issues_suggested_nizam" ON "fiqh_issues" ("suggested_nizam");

CREATE TABLE IF NOT EXISTS "fiqh_issue_links" (
  "id"             TEXT PRIMARY KEY,
  "issue_id"       TEXT NOT NULL REFERENCES "fiqh_issues" ("id") ON DELETE CASCADE,
  "article_id"     TEXT,                            -- مُحلّ من legal_articles عند البذر (مرجع منطقي)
  "law_name"       TEXT NOT NULL,
  "article_number" INTEGER NOT NULL,
  "citation"       TEXT NOT NULL,
  "score"          DOUBLE PRECISION NOT NULL,
  "rank"           INTEGER NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fiqh_issue_links_issue_law_article_key"
  ON "fiqh_issue_links" ("issue_id", "law_name", "article_number");
CREATE INDEX IF NOT EXISTS "idx_fiqh_issue_links_law_article" ON "fiqh_issue_links" ("law_name", "article_number");
CREATE INDEX IF NOT EXISTS "idx_fiqh_issue_links_article" ON "fiqh_issue_links" ("article_id");
