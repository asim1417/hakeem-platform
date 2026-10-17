DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-5f04576c512b3c453e7322ff' id,'cmpzcv89t0ar6vtrkyt3koxk9' unit_id,'يقصد بألفاظ وعبارات (السفينة، ومجهز السفينة، والربان، والبحار، وعقد العمل البحري) أينما وردت في هذا الباب المعاني المبينة حيالها في النظام البحري التجاري.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يقصد بألفاظ وعبارات (السفينة، ومجهز السفينة، والربان، والبحار، وعقد العمل البحري) أينما وردت في هذا الباب المعاني المبينة حيالها في النظام البحري التجاري".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '101ab2004736b46c7fde9b2414d229cb'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0ar6vtrkyt3koxk9') = '803a154317cd7c14e14aa1ad6974d33f'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0ar6vtrkyt3koxk9' AND valid_from='2025-02-19'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-a99691e819fea7dda47a3b6b' id,'cmpzcv89t0aryvtrkmwx1z6oy' unit_id,'يختص مفتشو العمل بما يأتي :

1 - مراقبة تنفيذ أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

2 - تزويد أصحاب العمل والعمال بالمعلومات والإرشادات الفنية التي تمكنهم من اتباع أحسن الوسائل لتنفيذ أحكام هذا النظام.

3 - إبلاغ الجهات المختصة بأوجه النقص التي تقصر الأحكام القائمة من معالجتها، واقتراح ما يلزم لذلك.

4 - ضبط مخالفات أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

5 - التحقق من المخالفات التي تضبطها جهات حكومية مختصة أخرى وتحال إلى الوزارة.

6 - اقتراح الغرامة المناسبة وفقاً لجدول المخالفات والعقوبات.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي:

"يختص مفتشو العمل بما يأتي :

1 - مراقبة تنفيذ أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

2 - تزويد أصحاب العمل والعمال بالمعلومات والإرشادات الفنية التي تمكنهم من اتباع أحسن الوسائل لتنفيذ أحكام هذا النظام.

3 - إبلاغ الجهات المختصة بأوجه النقص التي تقصر الأحكام القائمة من معالجتها، واقتراح ما يلزم لذلك.

4 - ضبط مخالفات أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

5 - ال' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '6a982e2f6ef54cba2637357a707a7b11'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0aryvtrkmwx1z6oy') = '932f9bc693d541a3ac67a9a6f1729780'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0aryvtrkmwx1z6oy' AND valid_from='2015-03-25'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-5c6c16732830d68c7579cda0' id,'cmpzcv89t0aryvtrkmwx1z6oy' unit_id,'يختص مفتشو العمل بما يأتي:

1- مراقبة تنفيذ أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

2- تزويد أصحاب العمل والعمال بالمعلومات والإرشادات الفنية التي تمكنهم من اتباع أحسن الوسائل لتنفيذ أحكام هذا النظام.

3- إبلاغ المختصين بالوزارة بأوجه النقص التي تقصرالأحكام القائمة عن معالجتها، واقتراح ما يلزم لذلك.

4- ضبط مخالفات أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

5- التحقق من المخالفات التي ترصدها جهات حكومية مختصة أخرى وتحال إلى الوزارة.

6- اقتراح الغرامة المناسبة وفقاً لجدول المخالفات والعقوبات.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يختص مفتشو العمل بما يأتي:

1- مراقبة تنفيذ أحكام هذا النظام واللائحة والقرارات الصادرة تنفيذاً له.

2- تزويد أصحاب العمل والعمال بالمعلومات والإرشادات الفنية التي تمكنهم من اتباع أحسن الوسائل لتنفيذ أحكام هذا النظام.

3- إبلاغ المختصين بالوزارة بأوجه النقص التي تقصرالأحكام القائمة عن معالجتها، واقتراح ما يلزم لذلك.

4- ضبط مخالف' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'da25ef36952dea50c95308dfd3b2686b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0aryvtrkmwx1z6oy') = '932f9bc693d541a3ac67a9a6f1729780'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0aryvtrkmwx1z6oy' AND valid_from='2025-02-19'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-a851ffcddbd44bc5516d2885' id,'cmpzcv89t0argvtrkjbv4vdcr' unit_id,'دون إخلال بالأحكام المتعلقة بعقد العمل البحري الواردة في هذا النظام؛ تصدر بقرار من الوزير -بالتنسيق مع الهيئة العامة للنقل- لائحة تنظيم عقد العمل البحري، وتشتمل على الأحكام المتعلقة بحقوق طرفي العقد والتزاماتها، وظروف المعيشة والسلامة والغذاء والنوم والترفيه على متن السفينة، والتدابير الواجب على صاحب العمل والراحة والإجازات، وتدريب وتنمية مهارات البحار، وأحكام إعادة البحار إلى موطنه، وإصدار شهادة التزام السفينة بأحكام هذا النظام، وآلية التفتيش والرقابة على التزام السفن في ضوء هذا النظام، وتحديد المخالفات والعقوبات المترتبة على ارتكابها، وأحكام التسوية الودية للشكاوى.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "دون إخلال بالأحكام المتعلقة بعقد العمل البحري الواردة في هذا النظام؛ تصدر بقرار من الوزير -بالتنسيق مع الهيئة العامة للنقل- لائحة تنظيم عقد العمل البحري، وتشتمل على الأحكام المتعلقة بحقوق طرفي العقد والتزاماتها، وظروف المعيشة والسلامة والغذاء والنوم والترفيه على متن السفينة، والتدابير الواجب على صاحب العمل والراحة والإجازات، وتدر' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '3b287eb5bbc2cce9ae13e69646d039dc'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0argvtrkjbv4vdcr') = '4523ff3d9dcb4bbe707b504b36053462'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0argvtrkjbv4vdcr' AND valid_from='2025-02-19'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-d2cd159254beaee82c98b8d3' id,'cmpzcv89u0asbvtrkqa5otq2i' unit_id,'يصدر الوزير اللائحة التنفيذية لضبط أعمال التفتيش وتنظيمها.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يصدر الوزير اللائحة التنفيذية لضبط أعمال التفتيش وتنظيمها".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '866cce1b7ff6c33c2e18cd6ce3458f03'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89u0asbvtrkqa5otq2i') = '02f789540116fdcce3f035ce6407605a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89u0asbvtrkqa5otq2i' AND valid_from='2025-02-19'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-bb838057a32aa65421a43b02' id,'cmpz6qkul0buncwg2yvrfun70' unit_id,'يقتطع شهريًّا نسبة ( 9% ) من راتب العسكري وتدفع إلى المصلحة لحساب الصندوق وتدفع الحكومة بواسطة  وزارة المالية والاقتصاد الوطني    ما يقابل نسبة ( 13% ) من راتب العسكري إلى المصلحة لحساب الصندوق كما تدفع الحكومة بالإضافة إلى ذلك نسبة (18%) من رواتب الأفراد الذين ظلوا في الخدمة حتى تاريخ نفاذ هذا النظام وذلك عن الفترة من خدمتهم العسكرية السابقة لهذا التاريخ إذا كانوا غير خاضعين لحسم  العائدات التقاعدية  قبله.

ويجوز بقرار من  مجلس الوزراء بناءً على اقتراح من مجلس الشؤون الاقتصادية والتنمية والاقتصاد الوطني  تعديل حصة الحكومة بما يكفي لمواجهة الصندوق التزاماته ويحدد مجلس إدارة المؤسسة العامة للتقاعد والاقتصاد الوطني بقرار منه الإجراءات الواجب اتباعها في اقتطاع ودفع  العائدات التقاعدية المشار إليها في هذه المادة.' body,'2016-07-25'::timestamptz valid_from,'قرار مجلس الوزراء رقم 440 وتاريخ 20/10/1437هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0838afd4-ca76-4b4a-b1d1-a9a700f22afd/1' eu,'تم تعديل هذه المادة بموجب قرار مجلس الوزراء رقم (440) وتاريخ 20/ 10 / 1437هـ  ، كما يلى :

1 - إحلال عبارة  "بناءً على اقتراح من مجلس الشؤون الاقتصادية والتنمية"

محل عبارة  "بناءً على اقتراح وزير المالية" الواردة في المادة.

2 - إحلال عبارة  "ويحدد مجلس إدارة المؤسسة العامة للتقاعد"

محل عبارة  "ويحدد وزير المالية" الواردة في عجز المادة .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '61b36cddcfc9d3bfa48dbb69e822f5ab'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6qkul0buncwg2yvrfun70') = 'a6b36495dd16f074e3bf35f9b80ef75d'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6qkul0buncwg2yvrfun70' AND valid_from='2016-07-25'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-31e1198addfefb6eb8dab496' id,'cmpz6qmfh0bv7cwg29c5yk7sw' unit_id,'أ ) يجوز إبقاء الضابط في الخدمة بعد بلوغه السن المحددة للإحالة إلى التقاعد لمدة سنتين إذا كان بقاؤه ضروريًّا لصالح العمل، ويتم ذلك بقرار من الوزير بناء على توصية رئيس هيئة الأركان العامة، وتحسب هذه المدة في معاش التقاعد وتستقطع عنها  العائدات التقاعدية    ويجوز تمديدها سنة فأخرى على أن لا تتجاوز أربع سنوات. ويجوز بقرار من الوزير المختص – متى اقتضت مصلحة العمل – تمديد خدمة الضابط الطبيب الذي بلغ السن النظامية المحددة للإحالة على التقاعد، لمدة عشر سنوات كحد أقصى، على أن يكون التمديد على فترات لا تتجاوز كل منها خمس سنوات، وتحتسب مدة التمديد لغرض التقاعد، وتستقطع عنها العائدات التقاعدية، وفي جميع الأحوال يحال الضابط الطبيب على التقاعد متى بلغ سن الخامسة والستين .

ب ) يجوز إبقاء الفرد الفني في الخدمة العسكرية بعد بلوغه السن المحددة للإحالة إلى التقاعد لمدة خمس سنوات قابلة للتمديد لخمس سنوات أخرى إذا كان بقاؤه ضروريًّا في صالح العمل ويتم هذا بقرار من  رئيس هيئة الأركان العامة    بعد توصية رئيس هيئة إدارة الجيش أو قائد القوات الجوية أو البحرية وتحسب هذه المدة في معاش التقاعد، وتستقطع عنها العائدات التقاعدية.' body,'2002-12-01'::timestamptz valid_from,'مرسوم ملكي رقم م/35 وتاريخ 26/9/1423هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0838afd4-ca76-4b4a-b1d1-a9a700f22afd/1' eu,'صدر بشأن الفقرة ( أ )   قرارا  مجلس الوزراء رقم (107) وتاريخ 2 / 7 / 1420 هـ ، ورقم (290) وتاريخ 24 / 12 / 1421 هـ،

كما عدلت بإضافة النص التالى لنهاية الفقرة  بموجب  المرسوم الملكي رقم (م/35) وتاريخ 26 / 9 / 1423 هـ ، كما يلى :

"ويجوز بقرار من الوزير المختص – متى اقتضت مصلحة العمل – تمديد خدمة الضابط الطبيب الذي بلغ السن النظامية المحددة للإحالة على التقاعد، لمدة عشر سنوات كحد أقصى، على أن يكون التمديد على فترات لا تتجاوز كل منها خمس سنوات، وتحتسب مدة التمديد لغرض التقاعد، وتستقطع عنها العائدا' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'fe0d70f046e9a3bd29e9f2722a89b54e'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6qmfh0bv7cwg29c5yk7sw') = 'b649fd2bf53d6ace6965f18ec02df3c2'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6qmfh0bv7cwg29c5yk7sw' AND valid_from='2002-12-01'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8c9d1f4a17a688b4fdacf428' id,'cmpzcv6870a4qvtrkq4zb99yd' unit_id,'يصدر وزير التجارة بالاتفاق مع وزير الصناعة والثروة المعدنية اللوائح والقرارات اللازمة لتنفيذ أحكام هذا النظام' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"يصدر وزير التجارة بالاتفاق مع وزير الصناعة والثروة المعدنية اللوائح والقرارات اللازمة لتنفيذ أحكام هذا النظام".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f5e84738cecff859fc40f1af4cf79171'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a4qvtrkq4zb99yd') = 'bb672d6458b85539032dd2d37eea5cac'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a4qvtrkq4zb99yd' AND valid_from='2025-09-30'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-bcb0c01920d38b1ce52a7090' id,'cmpzcv6870a46vtrkat4pkkhm' unit_id,'1- تتولى وزارة الصناعة والثروة المعدنية الإشراف على صناعة المعادن الثمينة والأحجار الكريمة ومشغولاتها والأصناف المطلية والملبسة والمطعمة بها، والرقابة عليها، وذلك وفقاً لما تحدده اللوائح.

2- تتولى وزارة التجارة الإشراف على تجارة المعادن الثمينة والأحجار الكريمة ومشغولاتها والأصناف المطلية والملبسة والمطعمة بها، والرقابة عليها، وذلك وفقاً لما تحدده اللوائح' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"1- تتولى وزارة الصناعة والثروة المعدنية الإشراف على صناعة المعادن الثمينة والأحجار الكريمة ومشغولاتها والأصناف المطلية والملبسة والمطعمة بها، والرقابة عليها، وذلك وفقاً لما تحدده اللوائح.

2- تتولى وزارة التجارة الإشراف على تجارة المعادن الثمينة والأحجار الكريمة ومشغولاتها والأصناف المطلية والملبسة والمطعمة بها، والرقابة عليها، وذلك وفقاً لما تحدده اللوائح".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'c81174d70401b7feae2bbd41793ff540'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a46vtrkat4pkkhm') = '31d860389302f7ba9a0d27cdde7553b0'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a46vtrkat4pkkhm' AND valid_from='2025-09-30'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-ee0f96fdef8a78018b8891f3' id,'cmpzcv6870a47vtrkq78vg9dq' unit_id,'مع مراعاة ما تقضي به الأنظمة الأخرى لا تجوز مزاولة صناعة المعادن الثمينة والأحجار الكريمة إلا بعد الحصول على ترخيص بذلك من وزارة التجارة.' body,'2021-09-02'::timestamptz valid_from,'مرسوم ملكي رقم م/13 وتاريخ 1443/1/25هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- عُدلت هذه المادة وذلك بموجب المرسوم الملكي رقم (م/13) وتاريخ 1443/1/25هـ، لتكون بالنص الآتي: " مع مراعاة ما تقضي به الأنظمة الأخرى لا تجوز مزاولة صناعة المعادن الثمينة والأحجار الكريمة إلا بعد الحصول على ترخيص بذلك من وزارة التجارة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd8ef5ac21bf7ad6009538393a56ed763'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a47vtrkq78vg9dq') = '03822da3487c2e1d650bad44f947c236'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a47vtrkq78vg9dq' AND valid_from='2021-09-02'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0b7b9114b2980dbfef019f30' id,'cmpzcv6870a47vtrkq78vg9dq' unit_id,'1- مع مراعاة ما تقضي به الأنظمة الأخرى، لا تجوز مزاولة صناعة المعادن الثمينة والأحجار الكريمة إلا بعد الحصول على ترخيص بذلك من وزارة الصناعة والثروة المعدنية، وفقاً لما تحدده اللوائح من ضوابط وشروط.

2- تحدد اللوائح المقابل المالي للتراخيص والخدمات المقدمة وفقاً لأحكام هذا النظام' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"1- مع مراعاة ما تقضي به الأنظمة الأخرى، لا تجوز مزاولة صناعة المعادن الثمينة والأحجار الكريمة إلا بعد الحصول على ترخيص بذلك من وزارة الصناعة والثروة المعدنية، وفقاً لما تحدده اللوائح من ضوابط وشروط.

2- تحدد اللوائح المقابل المالي للتراخيص والخدمات المقدمة وفقاً لأحكام هذا النظام".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'bbaa6e64dea3faff5883baff1034d2ff'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a47vtrkq78vg9dq') = '03822da3487c2e1d650bad44f947c236'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a47vtrkq78vg9dq' AND valid_from='2025-09-30'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-61e8613da977be8cf82ef153' id,'cmpzcv6870a4fvtrkoz6n3d3j' unit_id,'لوزارة التجارة، بالاتفاق مع وزارة الصناعة والثروة المعدنية، إلزام أصحاب مصانع ومشاغل المعادن الثمينة باستخدام علامات دمغ، لتمييز مشغولاتهم، تسجل وفقاً لما تحدده اللوائح' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"لوزارة التجارة، بالاتفاق مع وزارة الصناعة والثروة المعدنية، إلزام أصحاب مصانع ومشاغل المعادن الثمينة باستخدام علامات دمغ، لتمييز مشغولاتهم، تسجل وفقاً لما تحدده اللوائح".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2e4991708cb8debc0edea4b9f4bd9002'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a4fvtrkoz6n3d3j') = 'bb75828eb9f9e9678480d5c89df71dfe'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a4fvtrkoz6n3d3j' AND valid_from='2025-09-30'::timestamptz);

INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8d5c24e51cc9ab02e0891a3a' id,'cmpzcv6870a4hvtrkq95yv10l' unit_id,'يجوز إقامة معارض مشغولات المعادن الثمينة والأحجار الكريمة وغيرها من الأصناف الخاضعة لهذا النظام بترخيص من الهيئة العامة للمعارض والمؤتمرات بالتنسيق مع وزارة التجارة، ويجوز استثناء المعروضات من الدمغ وبعض الإجراءات الأخرى المنصوص عليها في هذا النظام إذا كان القصد عرضها فقط، وذلك وفقاً لما تحدده اللوائح' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"يجوز إقامة معارض مشغولات المعادن الثمينة والأحجار الكريمة وغيرها من الأصناف الخاضعة لهذا النظام بترخيص من الهيئة العامة للمعارض والمؤتمرات بالتنسيق مع وزارة التجارة، ويجوز استثناء المعروضات من الدمغ وبعض الإجراءات الأخرى المنصوص عليها في هذا النظام إذا كان القصد عرضها فقط، وذلك وفقاً لما تحدده اللوائح".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd93d80356df9a312526604dc9b5c538b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a4hvtrkq95yv10l') = '466122adfdaff03fa587f59413a3698b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a4hvtrkq95yv10l' AND valid_from='2025-09-30'::timestamptz);

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-5f04576c512b3c453e7322ff','boe26-a99691e819fea7dda47a3b6b','boe26-5c6c16732830d68c7579cda0','boe26-a851ffcddbd44bc5516d2885','boe26-d2cd159254beaee82c98b8d3','boe26-bb838057a32aa65421a43b02','boe26-31e1198addfefb6eb8dab496','boe26-8c9d1f4a17a688b4fdacf428','boe26-bcb0c01920d38b1ce52a7090','boe26-ee0f96fdef8a78018b8891f3','boe26-0b7b9114b2980dbfef019f30','boe26-61e8613da977be8cf82ef153','boe26-8d5c24e51cc9ab02e0891a3a']); IF k <> 13 THEN RAISE EXCEPTION 'unit_versions chunk 3: % of 13', k; END IF; END $c$;