-- HKM-025: تحقق للقراءة فقط من حقن المرحلة 1 (لا كتابة). شُغّل على Neon misty-base-66693229 / production.
-- التشغيل داخل معاملة واحدة:
SET TRANSACTION READ ONLY;

SELECT now() AT TIME ZONE 'Asia/Riyadh' AS read_at,
       current_setting('transaction_read_only') AS ro,
       (SELECT count(*) FROM unit_version) AS uv_total,
       -- نسخ المرحلة 1 مطابقة للوسيط: النص والمادة وتاريخ السريان
       (SELECT count(*) FROM unit_version u JOIN boe_inject.p1_unit_version s
          ON s.id = u.id AND u.body = s.body AND u.unit_id = s.unit_id AND u.valid_from = s.valid_from::timestamptz) AS uv_p1_exact,
       (SELECT count(*) FROM verification) AS ver_total,
       (SELECT count(*) FROM verification WHERE verified_by = 'boe-phase1-2026-10-16') AS ver_p1,
       (SELECT count(*) FROM verification WHERE verified_by = 'boe-phase1-2026-10-16' AND object_type = 'unit' AND verified_status = 'ملغاة') AS ver_unit_repealed,
       (SELECT count(*) FROM verification WHERE verified_by = 'boe-phase1-2026-10-16' AND object_type = 'work') AS ver_work,
       -- الصف المستبعد (نظام التنفيذ 1433هـ المخلوط) يجب ألا يوجد
       (SELECT count(*) FROM verification WHERE id = 'boe26-0c04a47fbfbfe0dabeb165b6') AS excluded_present,
       (SELECT min(created_at) FROM unit_version u WHERE u.id IN (SELECT id FROM boe_inject.p1_unit_version)) AS uv_written_at,
       (SELECT max(verified_at) FROM verification WHERE verified_by = 'boe-phase1-2026-10-16') AS ver_written_at,
       (SELECT md5(string_agg(u.id || u.unit_id || md5(u.body) || u.valid_from::date, ',' ORDER BY u.id))
          FROM unit_version u WHERE u.id IN (SELECT id FROM boe_inject.p1_unit_version)) AS uv_fingerprint;

SELECT verified_status, count(*) FROM verification
WHERE verified_by = 'boe-phase1-2026-10-16' AND object_type = 'work'
GROUP BY 1 ORDER BY 2 DESC;
