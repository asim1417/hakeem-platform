-- unit_status: 1 صفًا — إضافة فقط، كل صف بحارسه
BEGIN;
DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-d1678401414729ed2c383551','unit','cmpwia2m601opnxffsejus63h','ملغاة','Noneهـ','https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1','المادة الخامسة والثلاثين

أُلغيت هذه المادة بموجب المرسوم الملكي (م/93) وتاريخ 1441/8/15هـ، الصادر بشأن الموافقة على نظام المحاكم التجارية.','rule','boe-phase1-2026-10-16'
WHERE (SELECT md5(content) FROM legal_articles WHERE id='cmpwia2m601opnxffsejus63h') = '8b8aca0b47f503a2c561a9730a9fc53f';
DO $c$ DECLARE k int; BEGIN
  SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-d1678401414729ed2c383551']);
  IF k <> 1 THEN RAISE EXCEPTION 'unit_status: inserted % of 1', k; END IF; END $c$;
COMMIT;
