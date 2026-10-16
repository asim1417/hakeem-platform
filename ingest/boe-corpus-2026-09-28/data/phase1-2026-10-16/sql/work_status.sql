-- work_status: 50 صفًا — إضافة فقط، كل صف بحارسه
BEGIN;
DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-747837b99b7fee35b7833be8','work','cmpz5phaq002tcwg2ji1zv7pn','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/02dbc4d4-4763-41f9-9039-a9a700f1c0c1/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5phaq002tcwg2ji1zv7pn');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-97e533fcde3289601cbc30f3','work','cmpz5pb3a001xcwg2gyp5i7lg','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0b15d62d-6e3a-4894-b6fa-ad0700926350/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pb3a001xcwg2gyp5i7lg');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-4128d2c0e2e3a2107884ae5e','work','cmpz5qqp70097cwg2sfu5iv9m','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0b5b0f37-b2c9-4b3f-8657-acce001690f5/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qqp70097cwg2sfu5iv9m');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e71b6fc5003290615ed0ddb3','work','cmpz5qpc70090cwg28z3cyqij','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f0ebdaa-a50b-4410-9460-abe500b03486/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qpc70090cwg28z3cyqij');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-f48ffb264571e332a026bd3b','work','cmpz5rm6z00cjcwg234eonurh','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/1603064a-ab7e-48eb-9564-a9a700f2d2e0/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rm6z00cjcwg234eonurh');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-5d49ac5221b9426c20eb4871','work','cmpz5oxa80000cwg2fk53i9pj','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/16b97fcb-4833-4f66-8531-a9a700f161b6/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxa80000cwg2fk53i9pj');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-2ee70adeee9b1ffaf53a18bd','work','cmpz5qijx0082cwg2i3piouc5','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2072c9ff-5a70-444e-91cc-a9a700f26346/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qijx0082cwg2i3piouc5');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-6e0817aa9c1a91dd53f06f14','work','cmpz5ri0a00c8cwg2rwtubhz9','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/25fed59a-2790-4a77-ab11-a9a700f2c5fd/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5ri0a00c8cwg2rwtubhz9');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-a5affe599b9205ab2ce07d23','work','cmpz5oya70004cwg2od81fijc','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3213c2f6-eaf8-45dc-8f8c-a9a700f167ee/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oya70004cwg2od81fijc');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-a144de4bb34baacf73ae9a7a','work','69e83c49b30840eeb64df1837bfc4281','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/39ee8b3c-770c-4e20-84bf-b33200b5b50a/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='69e83c49b30840eeb64df1837bfc4281');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-3eb515b7209ac9321818e8b8','work','cmpz5pov3003vcwg280cpca86','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/39f72c5b-1156-43fc-8b56-aa8000aebae2/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pov3003vcwg280cpca86');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-8d280739c6b9f4b493d08c26','work','cmpz5qrh5009bcwg2m94qrcod','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3a56a72a-64f5-4902-b5f0-a9ec013d1bb1/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qrh5009bcwg2m94qrcod');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-584fd2d9d86bcca72e91f541','work','cmpz5qz2r00adcwg2tfe62w2s','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3d191772-e60b-4925-b5e7-aba50097641f/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qz2r00adcwg2tfe62w2s');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-786a4bf4d8afd5acc9ba5c53','work','cmpz5pj1k0032cwg262ocrzeh','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/4100e06a-1a43-458d-a3b4-a9a700f1e3d9/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pj1k0032cwg262ocrzeh');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-51746724c3b563b7220268b0','work','cmpz5qsv6009icwg2dk7dw3nj','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/4d0f16b6-fb15-44e3-b88c-ac4b00e40a6d/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qsv6009icwg2dk7dw3nj');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-eef9ac192be6c077cff91256','work','cmpz5pd150027cwg25aec1hlf','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/52da052e-9de3-4ead-abbf-aa3f00ef5083/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pd150027cwg25aec1hlf');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-b7f043d42ee59c8b15f00639','work','cmpz5qt95009kcwg2m091d9ly','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/58b1d864-0d14-4ed7-9c5e-ac4e00b5aff9/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qt95009kcwg2m091d9ly');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-0c1d7e5475b3bcdcb8f9d726','work','cmpz5qt25009jcwg2dqu2ffu1','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5fa38926-e89f-42fc-bf9f-ac4d00e16635/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qt25009jcwg2dqu2ffu1');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-12601515e04079a5c3def753','work','cmpz5psxm004gcwg2zub1ek0a','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/66eccea3-fc1c-471f-bcfa-ad9d009a7ec0/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5psxm004gcwg2zub1ek0a');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-9d2de3235fe1f75d5c3e7c9b','work','cmpz5rg4c00c2cwg22ehsnc7c','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7799b707-e228-452c-8b19-ac7b00b4b64e/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rg4c00c2cwg22ehsnc7c');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-28848b9f2d1a88838a0b1ca6','work','cmpz5qfgb007mcwg2msul8acv','ملغى',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7912ce55-36b8-4db2-8e59-a9eb016d382f/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qfgb007mcwg2msul8acv');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-c1cf0a17565c587af2bb79c0','work','cmpz5r3c900azcwg2d94vwujb','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/7ea51f01-916d-4f4b-81b3-a9ed010a6dc5/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r3c900azcwg2d94vwujb');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-7a976c0a906ad61ca786bda6','work','f9fe3e87e7da4e4cac67930ac0395d59','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/80edfc3f-789b-4abf-9920-b13700da43e8/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='f9fe3e87e7da4e4cac67930ac0395d59');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-a703e88bc5e401c2bdabe584','work','cmpz5oyh60005cwg28xmf5p77','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/83431376-5cf3-4374-875a-a9a700f16985/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oyh60005cwg28xmf5p77');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e63074032ff11472e65f2af9','work','cmpz5qluh008icwg2pzqde7x1','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/856b8992-cf28-422a-96a8-a9ec0127f6e7/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qluh008icwg2pzqde7x1');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-a9765c6093d849865154a002','work','cmpz5r6zj00bbcwg225jusnib','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8ff3cd90-e466-4bf9-a071-a9a700f2a70d/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r6zj00bbcwg225jusnib');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-c86f75941001ef1e04686043','work','cmpz5q64l006bcwg219ge11zr','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/921c3d40-85cd-4f5e-aa97-aca900b92c72/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5q64l006bcwg219ge11zr');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-bc56b2504713d3a269a25f3c','work','cmpz5oxw80002cwg2yrfwqc0w','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/93e87aa7-f344-4711-b97c-a9a700f1662b/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxw80002cwg2yrfwqc0w');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-8d7b94f43a667ee259e3957f','work','cmpz5oy370003cwg2bn3uq20v','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/93f81644-fbbc-49ca-b33c-a9a700f16701/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oy370003cwg2bn3uq20v');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e312b905a8ea0ce0d04d7dce','work','1e30ec0f017846aa910672b7e478d470','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9bfa5aa2-77cb-4e3d-a3e7-b20a00c3dccb/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1e30ec0f017846aa910672b7e478d470');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e56adef05ccbcfa390a59189','work','cmpz5rgf700c3cwg2jmb08zy6','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9f08ef46-6240-4fd7-a437-ac8900df75a8/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rgf700c3cwg2jmb08zy6');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-be228f8ac04cbfe692e5c7a6','work','b34f149ba7e54f1ca92e299fb6306460','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/a187d565-1a52-45cc-a1de-b2dc00daae23/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='b34f149ba7e54f1ca92e299fb6306460');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e8b341b91d51bd56ed1d6fc9','work','1d3fc5777fe04249bd6cfe220ee053a8','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/abfdc6be-18f4-4daf-ac9b-b13600b9691e/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1d3fc5777fe04249bd6cfe220ee053a8');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-d416a0ae4ccf09d4da4e82ea','work','cmpz5qyvr00accwg28wrlybd7','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/acf735b8-a606-424e-8c0e-aaab016118b6/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qyvr00accwg28wrlybd7');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-fa6883080e5f3f50f2e7afd9','work','cmpz5r4p500b6cwg2t04bq0yd','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b3060214-c11a-4709-b191-aca700cbcc58/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5r4p500b6cwg2t04bq0yd');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-65401e391af6e7f9ea8561f0','work','4dcc2bfb269e4b4b8d5bc9772f292f81','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b5831be8-4f04-41fc-9c7d-b44900879a0d/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='4dcc2bfb269e4b4b8d5bc9772f292f81');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-97a1869c460e04256e281e9c','work','cmpz5oxp80001cwg2anpzl275','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b5cf540a-e6ac-426a-b348-a9a700f163de/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oxp80001cwg2anpzl275');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-5a1a630634748fdfd2b43315','work','cmpz5pqlu0044cwg2dzxmg6u3','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/bf9e0aae-6df6-4785-a305-ac2300bd0856/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pqlu0044cwg2dzxmg6u3');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-0c04a47fbfbfe0dabeb165b6','work','cmpwi0c2p001znxffggwph0fg','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c81ba2f1-1bf1-443b-9b1c-a9a700f27110/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpwi0c2p001znxffggwph0fg');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-240423fb455657c3de0d8e25','work','cmpz5qgf7007rcwg211uaanv0','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cb055cd5-3055-4b20-8ec7-abef00ae3433/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5qgf7007rcwg211uaanv0');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-4b542b60b3417582875eb2bc','work','cmpz5pqsu0045cwg2qur3vtp4','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cb94c5cf-017b-46c1-92b8-ac3e00deaff7/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pqsu0045cwg2qur3vtp4');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-29665ddb70cfedec63188567','work','cmpz5rq9f00cwcwg2dko8w4lw','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cddb94e2-167b-4158-af5f-a9a700f2de58/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rq9f00cwcwg2dko8w4lw');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-978e61719bd808f18b5caad6','work','bb01076499054ea6b8a2c13849c0b168','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ce1982e0-5c1c-4f2e-91fa-b13700eeb592/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='bb01076499054ea6b8a2c13849c0b168');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-e35e29a682797aa45176864b','work','cmpz5pf5v002icwg2mt8tagez','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e3605c0d-ef87-4cff-b5da-aa3f0102bbb4/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5pf5v002icwg2mt8tagez');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-0c3dd83cabfe000e3bf2bcc1','work','cmpz5peyx002hcwg2i0z53bv9','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e7bd6fcc-c29c-4696-8032-aae9009b113a/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5peyx002hcwg2i0z53bv9');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-dff151aa3d82879c0aba94e5','work','cmpz5q1h0005ncwg2x448ukor','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ece2f7dc-db78-4ba4-a9e4-a9a700f20da3/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5q1h0005ncwg2x448ukor');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-66cbc46ebb9699117ad1a636','work','cmpz5rt6500d5cwg25ey9d89j','ملغى',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f7092b7f-77b4-4205-8dcf-a9a700f2e91c/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5rt6500d5cwg25ey9d89j');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-28816266f479614fc00c4d36','work','1d803161ac864b12be802173f685505c','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f95abff1-7f8b-4aea-9e97-adb900a2576e/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='1d803161ac864b12be802173f685505c');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-96dcba6ce121cc0f779cf4a2','work','cmpz5oz940009cwg2f55akfd3','ساري',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/fe1771f7-158f-4570-9bb1-a9a700f16dec/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ساري (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='cmpz5oz940009cwg2f55akfd3');
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT 'boe26-d0f397bae9fdcff26d83ea96','work','b2b20e3951ad444289849b3b07d47afc','ملغى',NULL,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b06b79ad-efe0-4d3e-8c45-ab1000b16b96/1','حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: لاغي (رُصدت 28/9/2026)','rule','boe-phase1-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE object_type='work' AND object_id='b2b20e3951ad444289849b3b07d47afc');
DO $c$ DECLARE k int; BEGIN
  SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-747837b99b7fee35b7833be8','boe26-97e533fcde3289601cbc30f3','boe26-4128d2c0e2e3a2107884ae5e','boe26-e71b6fc5003290615ed0ddb3','boe26-f48ffb264571e332a026bd3b','boe26-5d49ac5221b9426c20eb4871','boe26-2ee70adeee9b1ffaf53a18bd','boe26-6e0817aa9c1a91dd53f06f14','boe26-a5affe599b9205ab2ce07d23','boe26-a144de4bb34baacf73ae9a7a','boe26-3eb515b7209ac9321818e8b8','boe26-8d280739c6b9f4b493d08c26','boe26-584fd2d9d86bcca72e91f541','boe26-786a4bf4d8afd5acc9ba5c53','boe26-51746724c3b563b7220268b0','boe26-eef9ac192be6c077cff91256','boe26-b7f043d42ee59c8b15f00639','boe26-0c1d7e5475b3bcdcb8f9d726','boe26-12601515e04079a5c3def753','boe26-9d2de3235fe1f75d5c3e7c9b','boe26-28848b9f2d1a88838a0b1ca6','boe26-c1cf0a17565c587af2bb79c0','boe26-7a976c0a906ad61ca786bda6','boe26-a703e88bc5e401c2bdabe584','boe26-e63074032ff11472e65f2af9','boe26-a9765c6093d849865154a002','boe26-c86f75941001ef1e04686043','boe26-bc56b2504713d3a269a25f3c','boe26-8d7b94f43a667ee259e3957f','boe26-e312b905a8ea0ce0d04d7dce','boe26-e56adef05ccbcfa390a59189','boe26-be228f8ac04cbfe692e5c7a6','boe26-e8b341b91d51bd56ed1d6fc9','boe26-d416a0ae4ccf09d4da4e82ea','boe26-fa6883080e5f3f50f2e7afd9','boe26-65401e391af6e7f9ea8561f0','boe26-97a1869c460e04256e281e9c','boe26-5a1a630634748fdfd2b43315','boe26-0c04a47fbfbfe0dabeb165b6','boe26-240423fb455657c3de0d8e25','boe26-4b542b60b3417582875eb2bc','boe26-29665ddb70cfedec63188567','boe26-978e61719bd808f18b5caad6','boe26-e35e29a682797aa45176864b','boe26-0c3dd83cabfe000e3bf2bcc1','boe26-dff151aa3d82879c0aba94e5','boe26-66cbc46ebb9699117ad1a636','boe26-28816266f479614fc00c4d36','boe26-96dcba6ce121cc0f779cf4a2','boe26-d0f397bae9fdcff26d83ea96']);
  IF k <> 50 THEN RAISE EXCEPTION 'work_status: inserted % of 50', k; END IF; END $c$;
COMMIT;
