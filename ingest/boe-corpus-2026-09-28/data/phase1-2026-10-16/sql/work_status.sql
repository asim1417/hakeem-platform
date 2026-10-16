-- work_status: 50 صفًا — إضافة فقط، كل صف بحارسه
BEGIN;
DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-747837b99b7fee35b7833be8' id,'work' ot,'cmpz5phaq002tcwg2ji1zv7pn' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/02dbc4d4-4763-41f9-9039-a9a700f1c0c1/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'd02cf717f858cb1db08a637e54593471'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5phaq002tcwg2ji1zv7pn');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-97e533fcde3289601cbc30f3' id,'work' ot,'cmpz5pb3a001xcwg2gyp5i7lg' oi,'ساري' vs,'قرار مجلس الوزراء رقم 386 وتاريخ 1442/7/11هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0b15d62d-6e3a-4894-b6fa-ad0700926350/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '835b73b854f0f9878e8c3aed9221a4dc'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pb3a001xcwg2gyp5i7lg');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-4128d2c0e2e3a2107884ae5e' id,'work' ot,'cmpz5qqp70097cwg2sfu5iv9m' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0b5b0f37-b2c9-4b3f-8657-acce001690f5/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '8b0a93bd07f78c2ec4afc8d3c526d764'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qqp70097cwg2sfu5iv9m');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e71b6fc5003290615ed0ddb3' id,'work' ot,'cmpz5qpc70090cwg28z3cyqij' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f0ebdaa-a50b-4410-9460-abe500b03486/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '9696543610566f31f64f2d9f144e14c3'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qpc70090cwg28z3cyqij');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-f48ffb264571e332a026bd3b' id,'work' ot,'cmpz5rm6z00cjcwg234eonurh' oi,'ساري' vs,'قرار مجلس الوزراء رقم 91 وتاريخ 1379/6/29هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/1603064a-ab7e-48eb-9564-a9a700f2d2e0/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '57b2f0c468af852674428bf077762bf3'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rm6z00cjcwg234eonurh');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-5d49ac5221b9426c20eb4871' id,'work' ot,'cmpz5oxa80000cwg2fk53i9pj' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/16b97fcb-4833-4f66-8531-a9a700f161b6/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '002578e26754bcaf9f458f731273f867'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxa80000cwg2fk53i9pj');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-2ee70adeee9b1ffaf53a18bd' id,'work' ot,'cmpz5qijx0082cwg2i3piouc5' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2072c9ff-5a70-444e-91cc-a9a700f26346/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '3bc95a4dcd6e36e3e93617ea9f78328e'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qijx0082cwg2i3piouc5');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-6e0817aa9c1a91dd53f06f14' id,'work' ot,'cmpz5ri0a00c8cwg2rwtubhz9' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/25fed59a-2790-4a77-ab11-a9a700f2c5fd/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '6b593c6417ab313c0a4c6393710111d7'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5ri0a00c8cwg2rwtubhz9');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-a5affe599b9205ab2ce07d23' id,'work' ot,'cmpz5oya70004cwg2od81fijc' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3213c2f6-eaf8-45dc-8f8c-a9a700f167ee/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '4cc595fd81dc05ead4bf39964eb26107'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oya70004cwg2od81fijc');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-a144de4bb34baacf73ae9a7a' id,'work' ot,'69e83c49b30840eeb64df1837bfc4281' oi,'ساري' vs,'قرار مجلس الوزراء رقم 628 وتاريخ 1443/11/15هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/39ee8b3c-770c-4e20-84bf-b33200b5b50a/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '62845e49049fc50e8426b8b713d4f91d'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='69e83c49b30840eeb64df1837bfc4281');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-3eb515b7209ac9321818e8b8' id,'work' ot,'cmpz5pov3003vcwg280cpca86' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/39f72c5b-1156-43fc-8b56-aa8000aebae2/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '50bcf36acc7fb0f0d79494020d5c64f6'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pov3003vcwg280cpca86');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-8d280739c6b9f4b493d08c26' id,'work' ot,'cmpz5qrh5009bcwg2m94qrcod' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3a56a72a-64f5-4902-b5f0-a9ec013d1bb1/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '048e8b746657877bbf0976a55cff42f0'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qrh5009bcwg2m94qrcod');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-584fd2d9d86bcca72e91f541' id,'work' ot,'cmpz5qz2r00adcwg2tfe62w2s' oi,'ساري' vs,'قرار مجلس الوزراء رقم 534 وتاريخ 1441/8/21هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3d191772-e60b-4925-b5e7-aba50097641f/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '8c54c7158d0757eb18e4055623752960'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qz2r00adcwg2tfe62w2s');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-786a4bf4d8afd5acc9ba5c53' id,'work' ot,'cmpz5pj1k0032cwg262ocrzeh' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/4100e06a-1a43-458d-a3b4-a9a700f1e3d9/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'b56a3d05fa4b176f202106ec7642930d'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pj1k0032cwg262ocrzeh');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-51746724c3b563b7220268b0' id,'work' ot,'cmpz5qsv6009icwg2dk7dw3nj' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/4d0f16b6-fb15-44e3-b88c-ac4b00e40a6d/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'a5c40ff253c0ffd454145727f69a8be2'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qsv6009icwg2dk7dw3nj');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-eef9ac192be6c077cff91256' id,'work' ot,'cmpz5pd150027cwg25aec1hlf' oi,'ساري' vs,'مرسوم ملكي رقم 92 وتاريخ 1440/8/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/52da052e-9de3-4ead-abbf-aa3f00ef5083/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'ce55c1877d025a20dc1873642928e32d'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pd150027cwg25aec1hlf');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-b7f043d42ee59c8b15f00639' id,'work' ot,'cmpz5qt95009kcwg2m091d9ly' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/58b1d864-0d14-4ed7-9c5e-ac4e00b5aff9/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '796fa12f83be1bb9b610c1d21fad5027'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qt95009kcwg2m091d9ly');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-0c1d7e5475b3bcdcb8f9d726' id,'work' ot,'cmpz5qt25009jcwg2dqu2ffu1' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5fa38926-e89f-42fc-bf9f-ac4d00e16635/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '127e7c3ab1357fc6310f1fe6bfc04996'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qt25009jcwg2dqu2ffu1');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-12601515e04079a5c3def753' id,'work' ot,'cmpz5psxm004gcwg2zub1ek0a' oi,'ساري' vs,'قرار مجلس الوزراء رقم 49 وتاريخ 1443/1/16هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/66eccea3-fc1c-471f-bcfa-ad9d009a7ec0/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '1a3fe363b9802634978ea9480cc8b513'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5psxm004gcwg2zub1ek0a');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-9d2de3235fe1f75d5c3e7c9b' id,'work' ot,'cmpz5rg4c00c2cwg22ehsnc7c' oi,'ساري' vs,'قرار مجلس الوزراء رقم 211 وتاريخ 1442/4/2هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7799b707-e228-452c-8b19-ac7b00b4b64e/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'fb18258bd3b6c345833cca72e031ad05'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rg4c00c2cwg22ehsnc7c');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-28848b9f2d1a88838a0b1ca6' id,'work' ot,'cmpz5qfgb007mcwg2msul8acv' oi,'ملغى' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7912ce55-36b8-4db2-8e59-a9eb016d382f/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '3e34508e068d58efe4db8507147ecdd4'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qfgb007mcwg2msul8acv');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-c1cf0a17565c587af2bb79c0' id,'work' ot,'cmpz5r3c900azcwg2d94vwujb' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7ea51f01-916d-4f4b-81b3-a9ed010a6dc5/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'ca8fcebe5af369a95e51d3c2cd5a5a17'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r3c900azcwg2d94vwujb');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-7a976c0a906ad61ca786bda6' id,'work' ot,'f9fe3e87e7da4e4cac67930ac0395d59' oi,'ساري' vs,'قرار مجلس الوزراء رقم 691 وتاريخ 1445/8/17هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/80edfc3f-789b-4abf-9920-b13700da43e8/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '541cb34fe39419523bcfbc1070594a85'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='f9fe3e87e7da4e4cac67930ac0395d59');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-a703e88bc5e401c2bdabe584' id,'work' ot,'cmpz5oyh60005cwg28xmf5p77' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/83431376-5cf3-4374-875a-a9a700f16985/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '3e7362e17647d8957f1f3cdc2051de71'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oyh60005cwg28xmf5p77');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e63074032ff11472e65f2af9' id,'work' ot,'cmpz5qluh008icwg2pzqde7x1' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/856b8992-cf28-422a-96a8-a9ec0127f6e7/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'af4963e046303b61478bfe331ed00b51'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qluh008icwg2pzqde7x1');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-a9765c6093d849865154a002' id,'work' ot,'cmpz5r6zj00bbcwg225jusnib' oi,'ساري' vs,'قرار مجلس الوزراء رقم 199 وتاريخ 1421/8/17هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8ff3cd90-e466-4bf9-a071-a9a700f2a70d/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'fd7c5ac0ba7901dc40c5c07982f7d330'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r6zj00bbcwg225jusnib');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-c86f75941001ef1e04686043' id,'work' ot,'cmpz5q64l006bcwg219ge11zr' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/921c3d40-85cd-4f5e-aa97-aca900b92c72/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '7b06ff3e11b4f5e30efa94303595ae47'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5q64l006bcwg219ge11zr');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-bc56b2504713d3a269a25f3c' id,'work' ot,'cmpz5oxw80002cwg2yrfwqc0w' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/93e87aa7-f344-4711-b97c-a9a700f1662b/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'f3bbd844b2aac48357b82efd4cbf60c9'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxw80002cwg2yrfwqc0w');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-8d7b94f43a667ee259e3957f' id,'work' ot,'cmpz5oy370003cwg2bn3uq20v' oi,'ساري' vs,NULL ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/93f81644-fbbc-49ca-b33c-a9a700f16701/1' eu,'حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '07868abea3dbca9ea894020a98fbe60f'
  AND NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oy370003cwg2bn3uq20v');
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
DO $c$ DECLARE k int; BEGIN
  SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-747837b99b7fee35b7833be8','boe26-97e533fcde3289601cbc30f3','boe26-4128d2c0e2e3a2107884ae5e','boe26-e71b6fc5003290615ed0ddb3','boe26-f48ffb264571e332a026bd3b','boe26-5d49ac5221b9426c20eb4871','boe26-2ee70adeee9b1ffaf53a18bd','boe26-6e0817aa9c1a91dd53f06f14','boe26-a5affe599b9205ab2ce07d23','boe26-a144de4bb34baacf73ae9a7a','boe26-3eb515b7209ac9321818e8b8','boe26-8d280739c6b9f4b493d08c26','boe26-584fd2d9d86bcca72e91f541','boe26-786a4bf4d8afd5acc9ba5c53','boe26-51746724c3b563b7220268b0','boe26-eef9ac192be6c077cff91256','boe26-b7f043d42ee59c8b15f00639','boe26-0c1d7e5475b3bcdcb8f9d726','boe26-12601515e04079a5c3def753','boe26-9d2de3235fe1f75d5c3e7c9b','boe26-28848b9f2d1a88838a0b1ca6','boe26-c1cf0a17565c587af2bb79c0','boe26-7a976c0a906ad61ca786bda6','boe26-a703e88bc5e401c2bdabe584','boe26-e63074032ff11472e65f2af9','boe26-a9765c6093d849865154a002','boe26-c86f75941001ef1e04686043','boe26-bc56b2504713d3a269a25f3c','boe26-8d7b94f43a667ee259e3957f','boe26-e312b905a8ea0ce0d04d7dce','boe26-e56adef05ccbcfa390a59189','boe26-be228f8ac04cbfe692e5c7a6','boe26-e8b341b91d51bd56ed1d6fc9','boe26-d416a0ae4ccf09d4da4e82ea','boe26-fa6883080e5f3f50f2e7afd9','boe26-65401e391af6e7f9ea8561f0','boe26-97a1869c460e04256e281e9c','boe26-5a1a630634748fdfd2b43315','boe26-0c04a47fbfbfe0dabeb165b6','boe26-240423fb455657c3de0d8e25','boe26-4b542b60b3417582875eb2bc','boe26-29665ddb70cfedec63188567','boe26-978e61719bd808f18b5caad6','boe26-e35e29a682797aa45176864b','boe26-0c3dd83cabfe000e3bf2bcc1','boe26-dff151aa3d82879c0aba94e5','boe26-66cbc46ebb9699117ad1a636','boe26-28816266f479614fc00c4d36','boe26-96dcba6ce121cc0f779cf4a2','boe26-d0f397bae9fdcff26d83ea96']);
  IF k <> 50 THEN RAISE EXCEPTION 'work_status: inserted % of 50', k; END IF; END $c$;
COMMIT;
