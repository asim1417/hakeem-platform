-- Hakeem project-control baseline. Aggregate reads only; no personal records.
-- Target: misty-base-66693229 / production / neondb.
-- Verify the target before running. Run all statements in the SAME connection/transaction.
-- MCP run_sql_transaction: pass SET TRANSACTION, SET LOCAL and SELECT as separate statements.
-- This SQL checks structure and stored flags; it does not certify legal completeness.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT jsonb_build_object(
  'observed_at', now(),
  'database', current_database(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'systems', (SELECT count(*) FROM public.legal_systems),
  'articles', (SELECT count(*) FROM public.legal_articles),
  'rulings', (SELECT count(*) FROM public.judicial_cases),
  'cards', (SELECT count(*) FROM public.law_card),
  'surfaces', (SELECT count(*) FROM public.search_surface),
  'versions', (SELECT count(*) FROM public.unit_version),
  'boe_laws', (SELECT count(*) FROM boe.current_law),
  'boe_matched_laws', (SELECT count(*) FROM boe.current_law l WHERE EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid = l.guid AND m.hakeem_system_id IS NOT NULL)),
  'boe_unmatched_laws', (SELECT count(*) FROM boe.current_law l WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid = l.guid AND m.hakeem_system_id IS NOT NULL)),
  'owner_decisions', (SELECT count(*) FROM boe.owner_decision),
  'empty_articles', (SELECT count(*) FROM public.legal_articles WHERE nullif(btrim(content), '') IS NULL),
  'missing_search_norm', (SELECT count(*) FROM public.legal_articles WHERE nullif(btrim(search_norm), '') IS NULL),
  'nonpositive_numbers', (SELECT count(*) FROM public.legal_articles WHERE "articleNumber" <= 0),
  'orphan_articles', (SELECT count(*) FROM public.legal_articles a LEFT JOIN public.legal_systems s ON s.id = a."legalSystemId" WHERE s.id IS NULL),
  'systems_without_articles', (SELECT count(*) FROM public.legal_systems s WHERE NOT EXISTS (SELECT 1 FROM public.legal_articles a WHERE a."legalSystemId" = s.id)),
  'systems_with_preamble', (SELECT count(*) FROM public.legal_systems WHERE nullif(btrim(preamble), '') IS NOT NULL),
  'duplicate_number_groups', (SELECT count(*) FROM (SELECT "legalSystemId", "articleNumber" FROM public.legal_articles GROUP BY 1,2 HAVING count(*) > 1) t),
  'duplicate_text_summary', (SELECT jsonb_build_object('groups', count(*), 'extra_rows', coalesce(sum(n-1),0)) FROM (SELECT count(*) n FROM public.legal_articles WHERE length(btrim(content)) >= 25 GROUP BY "legalSystemId", md5(btrim(content)) HAVING count(*) > 1) t),
  'count_mismatches', (SELECT jsonb_agg(t ORDER BY name) FROM (SELECT s.name, s."articleCount" stored, count(a.id) actual FROM public.legal_systems s LEFT JOIN public.legal_articles a ON a."legalSystemId" = s.id GROUP BY s.id HAVING s."articleCount" IS DISTINCT FROM count(a.id)::int) t),
  'missing_index_by_law', (SELECT jsonb_agg(t ORDER BY n DESC, "lawName") FROM (SELECT "lawName", count(*) n FROM public.legal_articles WHERE nullif(btrim(search_norm), '') IS NULL GROUP BY 1) t),
  'unmatched_boe_names', (SELECT jsonb_agg(l.name ORDER BY l.name) FROM boe.current_law l WHERE NOT EXISTS (SELECT 1 FROM boe.current_match m WHERE m.guid = l.guid AND m.hakeem_system_id IS NOT NULL)),
  'diff_verdicts', (SELECT jsonb_agg(t ORDER BY verdict) FROM (SELECT verdict, count(*) n FROM boe.diff GROUP BY verdict) t),
  'diff_computed_range', (SELECT jsonb_build_object('earliest', min(computed_at), 'latest', max(computed_at)) FROM boe.diff),
  'amendment_review', (SELECT jsonb_agg(t ORDER BY needs_review) FROM (SELECT needs_review, count(*) n FROM boe.amendment_note GROUP BY needs_review) t),
  'verification_summary', (SELECT jsonb_agg(t ORDER BY object_type, verified_status) FROM (SELECT object_type, verified_status, count(*) n FROM public.verification GROUP BY 1,2) t)
) AS inventory;
ROLLBACK;
