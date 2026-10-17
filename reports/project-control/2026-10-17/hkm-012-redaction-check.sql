-- HKM-012: تشخيص مجمّع للقراءة فقط. لا يُرجع أي نص أو رقم؛ أعداد فقط.
-- Neon misty-base-66693229 / production / neondb. كل استعلام داخل معاملة واحدة:
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '180s';

-- ① فهرس البحث search_norm (نمط #704: أرقام لاتينية أو هندية)
SELECT count(*) AS total,
       count(*) FILTER (WHERE search_norm IS NOT NULL AND length(search_norm) > 0) AS sn_filled,
       count(*) FILTER (WHERE search_norm ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)') AS sn_id_any,
       count(*) FILTER (WHERE search_norm ~ '(^|[^0-9])[12][0-9]{9}([^0-9]|$)') AS sn_id_latin,
       count(*) FILTER (WHERE search_norm ~ '(^|[^٠-٩])[١٢][٠-٩]{9}([^٠-٩]|$)') AS sn_id_indic,
       count(*) FILTER (WHERE search_norm ~ '(^|[^0-9٠-٩])[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS sn_mobile_any,
       count(*) FILTER (WHERE search_norm ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)'
                           OR search_norm ~ '(^|[^0-9٠-٩])[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)'
                           OR search_norm ~ '(^|[^0-9٠-٩])([0٠][0٠])?[9٩][6٦][6٦][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS sn_leak_704,
       count(*) FILTER (WHERE search_norm LIKE '%محجوب%') AS sn_has_redaction_marker
FROM judicial_cases;

-- ② النص الأصلي المعروض (judgmentText / appealText / judgmentTitle)
SELECT count(*) FILTER (WHERE "judgmentText" ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)') AS jt_id,
       count(*) FILTER (WHERE "judgmentText" ~ '(^|[^0-9٠-٩])[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS jt_mobile,
       count(*) FILTER (WHERE "judgmentText" ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)'
                           OR "judgmentText" ~ '(^|[^0-9٠-٩])[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS jt_any,
       count(*) FILTER (WHERE coalesce("appealText",'') ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)'
                           OR coalesce("appealText",'') ~ '(^|[^0-9٠-٩])[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS appeal_any,
       count(*) FILTER (WHERE coalesce("judgmentTitle",'') ~ '(^|[^0-9٠-٩])[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)') AS title_id_pattern,
       -- نمط مسبوق بوسم صريح (أقوى دلالة من النمط الرقمي وحده)
       count(*) FILTER (WHERE "judgmentText" ~ '(هوية|سجل مدني|السجل المدني|إقامة|اقامة)[^0-9٠-٩]{0,25}[12١٢][0-9٠-٩]{9}([^0-9٠-٩]|$)') AS jt_id_with_label,
       count(*) FILTER (WHERE "judgmentText" ~ '(جوال|هاتف|رقم التواصل)[^0-9٠-٩]{0,25}[0٠][5٥][0-9٠-٩]{8}([^0-9٠-٩]|$)') AS jt_mobile_with_label
FROM judicial_cases;
