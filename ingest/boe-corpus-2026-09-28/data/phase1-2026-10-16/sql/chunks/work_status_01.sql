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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-747837b99b7fee35b7833be8','boe26-97e533fcde3289601cbc30f3','boe26-4128d2c0e2e3a2107884ae5e','boe26-e71b6fc5003290615ed0ddb3','boe26-f48ffb264571e332a026bd3b','boe26-5d49ac5221b9426c20eb4871','boe26-2ee70adeee9b1ffaf53a18bd','boe26-6e0817aa9c1a91dd53f06f14','boe26-a5affe599b9205ab2ce07d23','boe26-a144de4bb34baacf73ae9a7a','boe26-3eb515b7209ac9321818e8b8','boe26-8d280739c6b9f4b493d08c26','boe26-584fd2d9d86bcca72e91f541','boe26-786a4bf4d8afd5acc9ba5c53','boe26-51746724c3b563b7220268b0','boe26-eef9ac192be6c077cff91256','boe26-b7f043d42ee59c8b15f00639','boe26-0c1d7e5475b3bcdcb8f9d726','boe26-12601515e04079a5c3def753','boe26-9d2de3235fe1f75d5c3e7c9b','boe26-28848b9f2d1a88838a0b1ca6','boe26-c1cf0a17565c587af2bb79c0','boe26-7a976c0a906ad61ca786bda6','boe26-a703e88bc5e401c2bdabe584','boe26-e63074032ff11472e65f2af9','boe26-a9765c6093d849865154a002','boe26-c86f75941001ef1e04686043','boe26-bc56b2504713d3a269a25f3c','boe26-8d7b94f43a667ee259e3957f']); IF k <> 29 THEN RAISE EXCEPTION 'work_status chunk 1: % of 29', k; END IF; END $c$;