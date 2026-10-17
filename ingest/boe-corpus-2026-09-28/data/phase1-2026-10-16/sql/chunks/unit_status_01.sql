DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-e0c48b9242055cfed79dd6fe' id,'unit' ot,'cmpzcv89u0ascvtrkrg0woajv' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '640bf6c2762c576fec5b1b7aa1b287a9'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0ascvtrkrg0woajv') = 'f97a9af1d6527da56e40d9d6281de563';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-d28f00f11f76afec22cc4fef' id,'unit' ot,'cmpzcv89u0asdvtrkdc7333if' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'a64bc68c3dece48954f3ad62e407359d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asdvtrkdc7333if') = '30561510c38835371753bad6ef93823d';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-fc01e47c94fcde5b1519692b' id,'unit' ot,'cmpzcv89u0asevtrke8x2wcq4' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'f4d41ad22e3851590162993343b0ae46'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asevtrke8x2wcq4') = '879fd4988a338fa406d114c85f18836d';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-21235e13ef3ed193871ad089' id,'unit' ot,'cmpzcv89u0asfvtrk4fuo1n7j' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '642208b50a2f7122a87a7e661a4cca63'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asfvtrk4fuo1n7j') = '9ef7adb6886a9a5a4e7694007fa0f69a';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-bf5fe766604186bbebdc9902' id,'unit' ot,'cmpzcv89u0asgvtrkkj9rmb08' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '04cef2f07258f5d2606f4cabbd176f40'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asgvtrkkj9rmb08') = 'c134e94e8a9184b9b75e5fb48cd54b16';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-dc4774b746e6489b06313847' id,'unit' ot,'cmpzcv89u0ashvtrkcgnevlv8' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'ca1e5b03e73806eb1c0323051e39c982'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0ashvtrkcgnevlv8') = 'a5378ef87d3e8f2034a7847c7bd0f854';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-07d602b89bf4ddce9b67bbc8' id,'unit' ot,'cmpzcv89u0asivtrkdcpycxxn' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'b9a19772d5ba427d4553a63cc7755a27'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asivtrkdcpycxxn') = '6360bd67b918a5e3848c42808d549679';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-effff9c66a952b062a444bf2' id,'unit' ot,'cmpzcv89u0asjvtrkasykg6r9' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '376f72cc956ea55903871222aaa47972'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asjvtrkasykg6r9') = '350d8e2b9c6c6b21c33490d584db335e';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-f36c028adffd8d3f8003fd72' id,'unit' ot,'cmpzcv89u0askvtrk8ubr37jr' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'b81e3cad34ed4355753304887d647b3f'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0askvtrk8ubr37jr') = '78dd2e3f391f8b5dec9fb483a95e3c3d';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-8b1bd45d25eedac39565295f' id,'unit' ot,'cmpzcv89u0aslvtrkhx62m5sn' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '7427d201428f944452f387da15eda6f5'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0aslvtrkhx62m5sn') = 'af980f98d0855b81762da5db4eefa2c9';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-479792754e8cd0c1e00c030c' id,'unit' ot,'cmpzcv89u0asmvtrkvfmuapor' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هــ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'c758990813ef920f93917d4e9a278bda'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asmvtrkvfmuapor') = '7ea82b47262fde4d9870addc788e35ee';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-7e620dcf8340b56cf070e930' id,'unit' ot,'cmpzcv89u0asnvtrkklm6qyrk' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '1934aff397eda1552d6b56e44b7e63c8'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asnvtrkklm6qyrk') = 'b2e18025d2fbee62441b94fc49727915';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-7ecd15f2d55b2b5485e1e8e5' id,'unit' ot,'cmpzcv89u0asovtrkchw5jsxv' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '77ec81c9a6277af780489768446dea7c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asovtrkchw5jsxv') = 'dda43f7cf99b1c3a03a997f8d12a12b9';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-bad961fa7eb92114180045b7' id,'unit' ot,'cmpzcv89u0aspvtrkm8s9vsl0' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'd6318d0a6ba201962c138d71d711835c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0aspvtrkm8s9vsl0') = '33ae5ec689617da959534445775fcd3c';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-14e4daf0e64da6afc041514c' id,'unit' ot,'cmpzcv8yx0asqvtrkz5j5dhlb' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '0a02b4774d9c9d8b2c641cd9c3118b5a'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8yx0asqvtrkz5j5dhlb') = '102dd33bdb8ac4ca489664b958562cf2';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-ad5bb5e65a615be2e783c60e' id,'unit' ot,'cmpzcv8yx0asrvtrkn9yjarzn' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '75a911726e7945ab96c23a60638e3131'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8yx0asrvtrkn9yjarzn') = '5ec46fae848b8fac87c79f16a4f7ea6b';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-80e29816663f0d3c47d4565c' id,'unit' ot,'cmpzcv8yx0assvtrk3wgwlpq2' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '609f9582feaef24ca96880c41eb3a96a'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8yx0assvtrk3wgwlpq2') = 'aa9c589c317f00b97a18354cd3be143c';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-7921bdd831f6204365e431b0' id,'unit' ot,'cmpzcv8yy0astvtrkm7nb6wqg' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = 'f7c1ef93208e5987b752e4e54bbdbb6b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8yy0astvtrkm7nb6wqg') = '3de7591e99ff253d8a7e3627beab46a1';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-74ea89e9e54000950766f65a' id,'unit' ot,'cmpzcv8yy0asuvtrkfk9sbx4l' oi,'ملغاة' vs,'مرسوم ملكي رقم م/1 وتاريخ 22/1/1435هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم إلغاء الباب الرابع عشر بموجب المرسوم الملكي ( م/1 ) وتاريخ 22 / 1 / 1435 هـ' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '49aef6f04b3e1e8466b7c7c7e5a83da6'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8yy0asuvtrkfk9sbx4l') = 'fb4de011637edfca58318de7c0ae10d6';

INSERT INTO verification (id,object_type,object_id,verified_status,evidence_instrument,evidence_url,evidence_quote,method,verified_by)
SELECT * FROM (SELECT 'boe26-d1678401414729ed2c383551' id,'unit' ot,'cmpwia2m601opnxffsejus63h' oi,'ملغاة' vs,'مرسوم ملكي رقم م/93 وتاريخ 1441/8/15هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1' eu,'المادة الخامسة والثلاثين

أُلغيت هذه المادة بموجب المرسوم الملكي (م/93) وتاريخ 1441/8/15هـ، الصادر بشأن الموافقة على نظام المحاكم التجارية.' eq,'rule' me,'boe-phase1-2026-10-16' vb) v
WHERE md5(concat_ws(chr(31),v.id,v.ot,v.oi,v.vs,coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''),v.me,v.vb)) = '585f03c79c06647c5426a911331450da'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpwia2m601opnxffsejus63h') = '8b8aca0b47f503a2c561a9730a9fc53f';

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM verification WHERE id = ANY(ARRAY['boe26-e0c48b9242055cfed79dd6fe','boe26-d28f00f11f76afec22cc4fef','boe26-fc01e47c94fcde5b1519692b','boe26-21235e13ef3ed193871ad089','boe26-bf5fe766604186bbebdc9902','boe26-dc4774b746e6489b06313847','boe26-07d602b89bf4ddce9b67bbc8','boe26-effff9c66a952b062a444bf2','boe26-f36c028adffd8d3f8003fd72','boe26-8b1bd45d25eedac39565295f','boe26-479792754e8cd0c1e00c030c','boe26-7e620dcf8340b56cf070e930','boe26-7ecd15f2d55b2b5485e1e8e5','boe26-bad961fa7eb92114180045b7','boe26-14e4daf0e64da6afc041514c','boe26-ad5bb5e65a615be2e783c60e','boe26-80e29816663f0d3c47d4565c','boe26-7921bdd831f6204365e431b0','boe26-74ea89e9e54000950766f65a','boe26-d1678401414729ed2c383551']); IF k <> 20 THEN RAISE EXCEPTION 'unit_status chunk 1: % of 20', k; END IF; END $c$;