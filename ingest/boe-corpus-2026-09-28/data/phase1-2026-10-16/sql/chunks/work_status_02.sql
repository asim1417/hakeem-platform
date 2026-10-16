DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e312b905a8ea0ce0d04d7dce' id,'work' ot,'1e30ec0f017846aa910672b7e478d470' oi,'ساري' vs,'قرار مجلس الوزراء رقم 271 وتاريخ 1446/3/28هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9bfa5aa2-77cb-4e3d-a3e7-b20a00c3dccb/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '6333c5224cf297084b339cf509d7c7d4'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1e30ec0f017846aa910672b7e478d470');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e56adef05ccbcfa390a59189' id,'work' ot,'cmpz5rgf700c3cwg2jmb08zy6' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9f08ef46-6240-4fd7-a437-ac8900df75a8/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '804eef25279d1f754d4a1c38b133659e'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rgf700c3cwg2jmb08zy6');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-be228f8ac04cbfe692e5c7a6' id,'work' ot,'b34f149ba7e54f1ca92e299fb6306460' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/a187d565-1a52-45cc-a1de-b2dc00daae23/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '935b2ee483476f8aaead4d621094b412'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='b34f149ba7e54f1ca92e299fb6306460');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e8b341b91d51bd56ed1d6fc9' id,'work' ot,'1d3fc5777fe04249bd6cfe220ee053a8' oi,'ساري' vs,'قرار مجلس الوزراء رقم 631 وتاريخ 1445/8/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/abfdc6be-18f4-4daf-ac9b-b13600b9691e/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '94c86ba97e858ce3e3655a924e29cf48'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1d3fc5777fe04249bd6cfe220ee053a8');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-d416a0ae4ccf09d4da4e82ea' id,'work' ot,'cmpz5qyvr00accwg28wrlybd7' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/acf735b8-a606-424e-8c0e-aaab016118b6/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '22e09b93b9d4c09f71afa12cda31456a'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qyvr00accwg28wrlybd7');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-fa6883080e5f3f50f2e7afd9' id,'work' ot,'cmpz5r4p500b6cwg2t04bq0yd' oi,'ساري' vs,'قرار مجلس الوزراء رقم 262 وتاريخ 1442/5/14هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b3060214-c11a-4709-b191-aca700cbcc58/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'aac7e311d8d7b011425365c473651c04'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r4p500b6cwg2t04bq0yd');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-65401e391af6e7f9ea8561f0' id,'work' ot,'4dcc2bfb269e4b4b8d5bc9772f292f81' oi,'ساري' vs,'قرار مجلس الوزراء رقم 662 وتاريخ 1447/9/7هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b5831be8-4f04-41fc-9c7d-b44900879a0d/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '880079206f8279e91269c8ae8f5bfed2'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='4dcc2bfb269e4b4b8d5bc9772f292f81');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-97a1869c460e04256e281e9c' id,'work' ot,'cmpz5oxp80001cwg2anpzl275' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b5cf540a-e6ac-426a-b348-a9a700f163de/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '301633d297b39333ec87004322f2acfd'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxp80001cwg2anpzl275');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-5a1a630634748fdfd2b43315' id,'work' ot,'cmpz5pqlu0044cwg2dzxmg6u3' oi,'ساري' vs,'قرار مجلس الوزراء رقم 785 وتاريخ 1441/12/28هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/bf9e0aae-6df6-4785-a305-ac2300bd0856/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '0a093a2b572a663cae93905361794585'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pqlu0044cwg2dzxmg6u3');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-0c04a47fbfbfe0dabeb165b6' id,'work' ot,'cmpwi0c2p001znxffggwph0fg' oi,'ساري' vs,'مرسوم ملكي رقم م/53 وتاريخ 1433/8/13هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c81ba2f1-1bf1-443b-9b1c-a9a700f27110/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'b48b4d2f9aaa7f95b61144915baa7d1f'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpwi0c2p001znxffggwph0fg');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-240423fb455657c3de0d8e25' id,'work' ot,'cmpz5qgf7007rcwg211uaanv0' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cb055cd5-3055-4b20-8ec7-abef00ae3433/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '4a7a74529256d93455da52ef7e9f3a5b'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qgf7007rcwg211uaanv0');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-4b542b60b3417582875eb2bc' id,'work' ot,'cmpz5pqsu0045cwg2qur3vtp4' oi,'ساري' vs,'قرار مجلس الوزراء رقم 55 وتاريخ 1442/1/20هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cb94c5cf-017b-46c1-92b8-ac3e00deaff7/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '1a86a15b63b9f3f6981a3a069842fc0b'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pqsu0045cwg2qur3vtp4');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-29665ddb70cfedec63188567' id,'work' ot,'cmpz5rq9f00cwcwg2dko8w4lw' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cddb94e2-167b-4158-af5f-a9a700f2de58/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'b11b8488e405b87018368be2b80618b7'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rq9f00cwcwg2dko8w4lw');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-978e61719bd808f18b5caad6' id,'work' ot,'bb01076499054ea6b8a2c13849c0b168' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ce1982e0-5c1c-4f2e-91fa-b13700eeb592/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '8f1bc8cc62c6825130c1820bc9fe2524'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='bb01076499054ea6b8a2c13849c0b168');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e35e29a682797aa45176864b' id,'work' ot,'cmpz5pf5v002icwg2mt8tagez' oi,'ساري' vs,'قرار مجلس الوزراء رقم 372 وتاريخ 1440/6/28هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e3605c0d-ef87-4cff-b5da-aa3f0102bbb4/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '5a631b07da4c96d5c3992342e9141ccb'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pf5v002icwg2mt8tagez');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-0c3dd83cabfe000e3bf2bcc1' id,'work' ot,'cmpz5peyx002hcwg2i0z53bv9' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e7bd6fcc-c29c-4696-8032-aae9009b113a/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '32364b1a50f0858ceccfaea16a109613'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5peyx002hcwg2i0z53bv9');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-dff151aa3d82879c0aba94e5' id,'work' ot,'cmpz5q1h0005ncwg2x448ukor' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ece2f7dc-db78-4ba4-a9e4-a9a700f20da3/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '7404585d232b97b51359a3ad497899e6'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5q1h0005ncwg2x448ukor');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-66cbc46ebb9699117ad1a636' id,'work' ot,'cmpz5rt6500d5cwg25ey9d89j' oi,'ملغى' vs,'قرار مجلس الوزراء رقم 33 وتاريخ 1426/2/11هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f7092b7f-77b4-4205-8dcf-a9a700f2e91c/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'c4142885757cc01b8bda40db318f30f1'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rt6500d5cwg25ey9d89j');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-28816266f479614fc00c4d36' id,'work' ot,'1d803161ac864b12be802173f685505c' oi,'ساري' vs,'قرار مجلس الوزراء رقم 114 وتاريخ 1443/2/14هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f95abff1-7f8b-4aea-9e97-adb900a2576e/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'ec8f2168a69429f88a88b499c8b59391'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1d803161ac864b12be802173f685505c');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-96dcba6ce121cc0f779cf4a2' id,'work' ot,'cmpz5oz940009cwg2f55akfd3' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/fe1771f7-158f-4570-9bb1-a9a700f16dec/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'd53ab3a8fcc65eb623acc34ed61fd06d'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oz940009cwg2f55akfd3');

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-d0f397bae9fdcff26d83ea96' id,'work' ot,'b2b20e3951ad444289849b3b07d47afc' oi,'ملغى' vs,'قرار مجلس الوزراء رقم 211 وتاريخ 1441/3/15هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b06b79ad-efe0-4d3e-8c45-ab1000b16b96/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '6c27f033f057aa72dbb6444bd9660128'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='b2b20e3951ad444289849b3b07d47afc');

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-e312b905a8ea0ce0d04d7dce','boe26-e56adef05ccbcfa390a59189','boe26-be228f8ac04cbfe692e5c7a6','boe26-e8b341b91d51bd56ed1d6fc9','boe26-d416a0ae4ccf09d4da4e82ea','boe26-fa6883080e5f3f50f2e7afd9','boe26-65401e391af6e7f9ea8561f0','boe26-97a1869c460e04256e281e9c','boe26-5a1a630634748fdfd2b43315','boe26-0c04a47fbfbfe0dabeb165b6','boe26-240423fb455657c3de0d8e25','boe26-4b542b60b3417582875eb2bc','boe26-29665ddb70cfedec63188567','boe26-978e61719bd808f18b5caad6','boe26-e35e29a682797aa45176864b','boe26-0c3dd83cabfe000e3bf2bcc1','boe26-dff151aa3d82879c0aba94e5','boe26-66cbc46ebb9699117ad1a636','boe26-28816266f479614fc00c4d36','boe26-96dcba6ce121cc0f779cf4a2','boe26-d0f397bae9fdcff26d83ea96']); IF k <> 21 THEN RAISE EXCEPTION 'work_status chunk 2: % of 21', k; END IF; END $c$;