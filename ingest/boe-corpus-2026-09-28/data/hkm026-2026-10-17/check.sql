-- قراءة فقط بعد التطبيق.
SELECT (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = $hk$boe26-d757638789cfefd3fe9c817f$hk$) AS articles,
       (SELECT md5(string_agg(content, '|' ORDER BY "articleNumber")) FROM legal_articles WHERE "legalSystemId" = $hk$boe26-d757638789cfefd3fe9c817f$hk$) AS content_md5,
       (SELECT verified_status FROM verification WHERE object_type = 'work' AND object_id = $hk$cmpz5qfgb007mcwg2msul8acv$hk$ ORDER BY verified_at DESC, id DESC LIMIT 1) AS old_status,
       (SELECT verified_status FROM verification WHERE object_type = 'work' AND object_id = $hk$boe26-d757638789cfefd3fe9c817f$hk$ ORDER BY verified_at DESC, id DESC LIMIT 1) AS new_status,
       (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = $hk$cmpz5qfgb007mcwg2msul8acv$hk$) AS old_articles_kept;
