-- ملخّص تدقيق مُركّز: مقاييس القرار الحاسمة كصفوف (metric | value). قراءة فقط.
-- مصمّم ليُطبَع مضغوطًا فيُلتقَط في سجلّ صغير.
\pset pager off
SELECT metric, value FROM (
  SELECT 1 ord, 'systems_total'::text metric, (SELECT count(*) FROM legal_systems)::text value
  UNION ALL SELECT 2, 'articles_total', (SELECT count(*) FROM legal_articles)::text
  UNION ALL SELECT 3, 'articles_null_system', (SELECT count(*) FROM legal_articles WHERE "legalSystemId" IS NULL)::text
  UNION ALL SELECT 4, 'articles_empty_content', (SELECT count(*) FROM legal_articles WHERE content IS NULL OR btrim(content)='')::text
  UNION ALL SELECT 5, 'articles_distinct_status', (SELECT count(DISTINCT status) FROM legal_articles)::text
  UNION ALL SELECT 6, 'systems_zero_articles', (SELECT count(*) FROM legal_systems s WHERE NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a."legalSystemId"=s.id))::text
  UNION ALL SELECT 7, 'systems_null_classification', (SELECT count(*) FROM legal_systems WHERE classification IS NULL)::text
  UNION ALL SELECT 8, 'systems_null_eli', (SELECT count(*) FROM legal_systems WHERE eli_slug IS NULL)::text
  -- أنظمة مكرّرة بعد التطبيع (DATA-004)
  UNION ALL SELECT 9, 'systems_normalized_duplicates', (
    SELECT count(*) FROM (
      SELECT regexp_replace(translate(name,'إأآةى','ااااهي'),'\s+','','g') nn
      FROM legal_systems GROUP BY 1 HAVING count(*)>1
    ) t)::text
  -- يتيم (VERSION/relations)
  UNION ALL SELECT 10, 'articles_pointing_missing_system', (SELECT count(*) FROM legal_articles a WHERE a."legalSystemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM legal_systems s WHERE s.id=a."legalSystemId"))::text
  UNION ALL SELECT 11, 'links_missing_article', (SELECT count(*) FROM legal_article_case_links l WHERE NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id=l."articleId"))::text
  UNION ALL SELECT 12, 'links_missing_case', (SELECT count(*) FROM legal_article_case_links l WHERE NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id=l."caseId"))::text
  UNION ALL SELECT 13, 'principles_missing_source_case', (SELECT count(*) FROM judicial_principles p WHERE NOT EXISTS (SELECT 1 FROM judicial_cases c WHERE c.id=p."sourceCaseId"))::text
  UNION ALL SELECT 14, 'relations_orphan_article', (SELECT count(*) FROM legal_relations r WHERE r.source_type='article' AND NOT EXISTS (SELECT 1 FROM legal_articles a WHERE a.id=r.source_id))::text
  -- ★ الحرج: تعدّد النسخة النافذة (VERSION-001)
  UNION ALL SELECT 15, 'ARTICLES_MULTIPLE_CURRENT_VERSIONS', (SELECT count(*) FROM (SELECT article_id FROM article_versions WHERE effective_to IS NULL GROUP BY article_id HAVING count(*)>1) t)::text
  UNION ALL SELECT 16, 'article_versions_total', (SELECT count(*) FROM article_versions)::text
  UNION ALL SELECT 17, 'versions_with_effective_from', (SELECT count(*) FROM article_versions WHERE effective_from IS NOT NULL)::text
  UNION ALL SELECT 18, 'articles_without_any_version', (SELECT count(*) FROM legal_articles a WHERE NOT EXISTS (SELECT 1 FROM article_versions v WHERE v.article_id=a.id))::text
  -- مصدر (DATA-001): مواد بلا وسم source في keywords
  UNION ALL SELECT 19, 'articles_no_source_tag', (SELECT count(*) FROM legal_articles WHERE NOT EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k LIKE 'source:%'))::text
  UNION ALL SELECT 20, 'has_content_hash_column', (SELECT (count(*)>0)::text FROM information_schema.columns WHERE table_name='legal_articles' AND column_name='content_hash')
  UNION ALL SELECT 21, 'has_source_column', (SELECT (count(*)>0)::text FROM information_schema.columns WHERE table_name='legal_articles' AND column_name='source')
  -- تغطية المتجهات (EMB-3)
  UNION ALL SELECT 22, 'embeddings_total', (SELECT count(*) FROM embeddings)::text
  UNION ALL SELECT 23, 'embeddings_article', (SELECT count(*) FROM embeddings WHERE owner_type='article')::text
  UNION ALL SELECT 24, 'embeddings_ruling', (SELECT count(*) FROM embeddings WHERE owner_type='ruling')::text
  UNION ALL SELECT 25, 'embeddings_principle', (SELECT count(*) FROM embeddings WHERE owner_type='principle')::text
  UNION ALL SELECT 26, 'articles_without_vector', (SELECT count(*) FROM legal_articles a WHERE NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.owner_type='article' AND e.owner_id=a.id))::text
  UNION ALL SELECT 27, 'articles_over_8000_chars', (SELECT count(*) FROM legal_articles WHERE length(content)>8000)::text
  -- شذوذ نصّي (نصّ حيّ كامل)
  UNION ALL SELECT 28, 'content_short_lt15', (SELECT count(*) FROM legal_articles WHERE length(btrim(content))<15 AND btrim(content)<>'')::text
  UNION ALL SELECT 29, 'content_mixed_digits', (SELECT count(*) FROM legal_articles WHERE content ~ '[0-9]' AND content ~ '[٠-٩]')::text
  UNION ALL SELECT 30, 'content_equals_title', (SELECT count(*) FROM legal_articles WHERE btrim(content)=btrim(title))::text
  -- مراجعة
  UNION ALL SELECT 31, 'cases_needs_review', (SELECT count(*) FROM judicial_cases WHERE "reviewStatus"='needs_review')::text
  UNION ALL SELECT 32, 'cases_total', (SELECT count(*) FROM judicial_cases)::text
  UNION ALL SELECT 33, 'principles_needs_review', (SELECT count(*) FROM judicial_principles WHERE "reviewStatus"='needs_review')::text
  UNION ALL SELECT 34, 'relations_total', (SELECT count(*) FROM legal_relations)::text
) q ORDER BY ord;
