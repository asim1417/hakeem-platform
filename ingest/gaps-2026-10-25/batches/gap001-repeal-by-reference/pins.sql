-- قراءة فقط. شغّله داخل BEGIN; SET TRANSACTION READ ONLY; … ROLLBACK;
WITH p AS (
SELECT $hk$G1$hk$ k,
 (SELECT md5(content) FROM legal_articles WHERE id=$hk$cmpz635q403s5cwg2g93w06tr$hk$) rep_md5,
 (SELECT md5(s.name||'|'||coalesce(s.preamble_royal_decree,'')) FROM legal_systems s WHERE s.id=$hk$cmpz5pbv80021cwg2br8calht$hk$) rep_sys_md5,
 (SELECT x.id FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpz5pbv80021cwg2br8calht$hk$ AND x."articleBis"=0 AND x.content ~ '^\s*(يعمل|يُعمل|ينشر)[^.]*' AND x."articleNumber" >= (SELECT max("articleNumber")-3 FROM legal_articles WHERE "legalSystemId"=$hk$cmpz5pbv80021cwg2br8calht$hk$ AND "articleBis"=0) ORDER BY x."articleNumber" DESC LIMIT 1) eff_id,
 (SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x."articleNumber", x."articleBis")) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpwi0ckf0022nxffiy84kp3o$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 38 AND 57)) set_md5,
 (SELECT count(*) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpwi0ckf0022nxffiy84kp3o$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 38 AND 57)) n,
 (SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id=$hk$cmpwi0ckf0022nxffiy84kp3o$hk$ JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id
    WHERE u.css_class LIKE '%canceled%' AND u.article_number IN (38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57)) boe_struck,
 (SELECT l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_url,
 (SELECT l.guid FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_guid,
 (SELECT l.published_gregorian::date FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_published
UNION ALL
SELECT $hk$G2$hk$ k,
 (SELECT md5(content) FROM legal_articles WHERE id=$hk$cmpz635q403s5cwg2g93w06tr$hk$) rep_md5,
 (SELECT md5(s.name||'|'||coalesce(s.preamble_royal_decree,'')) FROM legal_systems s WHERE s.id=$hk$cmpz5pbv80021cwg2br8calht$hk$) rep_sys_md5,
 (SELECT x.id FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpz5pbv80021cwg2br8calht$hk$ AND x."articleBis"=0 AND x.content ~ '^\s*(يعمل|يُعمل|ينشر)[^.]*' AND x."articleNumber" >= (SELECT max("articleNumber")-3 FROM legal_articles WHERE "legalSystemId"=$hk$cmpz5pbv80021cwg2br8calht$hk$ AND "articleBis"=0) ORDER BY x."articleNumber" DESC LIMIT 1) eff_id,
 (SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x."articleNumber", x."articleBis")) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpwi0cw90024nxff1u02k8rn$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 101 AND 158)) set_md5,
 (SELECT count(*) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpwi0cw90024nxff1u02k8rn$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 101 AND 158)) n,
 (SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id=$hk$cmpwi0cw90024nxff1u02k8rn$hk$ JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id
    WHERE u.css_class LIKE '%canceled%' AND u.article_number IN (101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158)) boe_struck,
 (SELECT l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_url,
 (SELECT l.guid FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_guid,
 (SELECT l.published_gregorian::date FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pbv80021cwg2br8calht$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_published
UNION ALL
SELECT $hk$G3$hk$ k,
 (SELECT md5(content) FROM legal_articles WHERE id=$hk$cmpz6dlkf079tcwg2d4xnp0lc$hk$) rep_md5,
 (SELECT md5(s.name||'|'||coalesce(s.preamble_royal_decree,'')) FROM legal_systems s WHERE s.id=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$) rep_sys_md5,
 (SELECT x.id FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$ AND x."articleBis"=0 AND x.content ~ '^\s*(يعمل|يُعمل|ينشر)[^.]*' AND x."articleNumber" >= (SELECT max("articleNumber")-3 FROM legal_articles WHERE "legalSystemId"=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$ AND "articleBis"=0) ORDER BY x."articleNumber" DESC LIMIT 1) eff_id,
 (SELECT md5(string_agg(x.id||':'||md5(x.content), ',' ORDER BY x."articleNumber", x."articleBis")) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpz5piul0031cwg22r65v5gr$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 103 AND 137)) set_md5,
 (SELECT count(*) FROM legal_articles x WHERE x."legalSystemId"=$hk$cmpz5piul0031cwg22r65v5gr$hk$ AND x."articleBis"<100 AND (x."articleNumber" BETWEEN 103 AND 137)) n,
 (SELECT count(*) FROM boe.unit u JOIN boe.current_match m ON m.hakeem_system_id=$hk$cmpz5piul0031cwg22r65v5gr$hk$ JOIN boe.law l ON l.guid=m.guid AND l.id=u.law_id
    WHERE u.css_class LIKE '%canceled%' AND u.article_number IN (103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137)) boe_struck,
 (SELECT l.url FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_url,
 (SELECT l.guid FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_guid,
 (SELECT l.published_gregorian::date FROM boe.current_match m JOIN boe.law l ON l.guid=m.guid WHERE m.hakeem_system_id=$hk$cmpz5pmxa003lcwg2gvi5rlyr$hk$ ORDER BY (l.status_at_source='ساري') DESC LIMIT 1) rep_published
)
SELECT 'PINS' tag, json_agg(json_build_object('k',k,'rep_md5',rep_md5,'rep_sys_md5',rep_sys_md5,'eff_id',eff_id,'eff_md5',(SELECT md5(content) FROM legal_articles WHERE id=eff_id),'eff_text',(SELECT content FROM legal_articles WHERE id=eff_id),'set_md5',set_md5,'n',n,'boe_struck',boe_struck,'rep_url',rep_url,'rep_guid',rep_guid,'rep_published',rep_published)) pins FROM p;
