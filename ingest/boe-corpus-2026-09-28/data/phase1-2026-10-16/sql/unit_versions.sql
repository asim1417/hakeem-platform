-- unit_versions: 94 صفًا — إضافة فقط، كل صف بحارسه
BEGIN;
DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-5478f9f99e9ed36516206336' id,'cmpz5tzsb00q7cwg2u975h2vk' unit_id,'تنشئ بموجب هذا النظام دارة تسمى (دارة الملك عبد العزيز) وتكون هيئة مستقلة لها الشخصية الاعتبارية، وتلحق إداريا  بوزير التعليم العالي    ويكون مقرها مدينة الرياض' body,'1983-07-30'::timestamptz valid_from,'مرسوم ملكي رقم م/51 وتاريخ 20/10/1403هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0057fd8d-8ad4-48f9-b02f-a9a700f16a48/1' eu,'تم تعديل هذه المادة بموجب  المرسوم الملكي   رقم (م/51) وتاريخ 20 / 10 / 1403 هـ  ، بحيث تحل عبارة (  وزير التعليم العالي   ) محل عبارة (  وزير المعارف   ) أينما وردت في النظام .

وبهذا يصبح نص المادة كما يلى :

( تنشئ بموجب هذا النظام دارة تسمى (دارة الملك عبد العزيز) وتكون هيئة مستقلة لها الشخصية الاعتبارية، وتلحق إدارياً  بوزير التعليم العالى ويكون مقرها مدينة الرياض ) .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'af0bd76722276d78eba96560e80dab6c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5tzsb00q7cwg2u975h2vk') = '743e45d7fc82426b1aa1237b3534e6dc'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5tzsb00q7cwg2u975h2vk' AND valid_from='1983-07-30'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-e609ddbb78ed73718bf6d931' id,'cmpz5u03t00qbcwg2nyidj2e9' unit_id,'تقوم الدارة تحقيقا لأغراضها بالأمور الآتية :

أ  - إنشاء مكتبة تضم كل ما يخدم أغراض الدارة، وتنظم أعمالها لائحة يصدرها مجلس الإدارة.

ب  - تحقيق الكتب التي تخدم تاريخ المملكة وجغرافيتها وآدابها وآثارها العمرانية وطبعها وترجمتها بشكل خاص، وتاريخ الجزيرة العربية وبلاد العرب والإسلام بشكل عام.

ج  - إعداد بحوث ودراسات، ومحاضرات وندوات عن سيرة الملك عبد العزيز خاصة، وعن المملكة وحكامها، وإعلامها قديما وحديثا بصفة عامة.

د  - إنشاء قاعة تذكارية تضم كل ما يصور حياة الملك عبد العزيز، وآثار الدولة السعودية منذ نشأتها.

هـ - منح جائزة سنوية باسم -جائزة الملك عبد العزيز- لمؤلف أحسن كتاب يتفق مع أغراض الدارة.

و - إصدار مجلة ثقافية تخدم أغراض الدارة.

ز - ما يراه  مجلس الإدارة    محققا لأغراض الدارة.' body,'1979-06-20'::timestamptz valid_from,'مرسوم ملكي رقم م/39 وتاريخ 25/7/1399هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0057fd8d-8ad4-48f9-b02f-a9a700f16a48/1' eu,'تم تعديل نص الفقرة (هـ ) من المادة الثالثة من النظام بموجب المرسوم الملكي  رقم (م/39) وتاريخ 25/ 7/ 1399هـ ،  ليكون بالنص التالي :

(منح جائزة سنوية باسم - جائزة الملك عبد العزيز- لمؤلف أحسن كتاب يتفق مع أغراض الدارة).

ويكون نص المادة ; كما يلي :

تقوم الدارة تحقيقا لأغراضها بالأمور الآتية :

أ  - إنشاء مكتبة تضم كل ما يخدم أغراض الدارة، وتنظم أعمالها لائحة يصدرها مجلس الإدارة.

ب  - تحقيق الكتب التي تخدم تاريخ المملكة وجغرافيتها وآدابها وآثارها العمرانية وطبعها وترجمتها بشكل خاص، وتاريخ الجزير' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'dc201c23e644e4bf3c4f958b0c569fde'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5u03t00qbcwg2nyidj2e9') = '7c2b8f0f6502599b3fd39b0efa44a704'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5u03t00qbcwg2nyidj2e9' AND valid_from='1979-06-20'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8ecdd8b80232e0ba8cdd0d78' id,'cmpzcvci40busvtrkntz8mg8j' unit_id,'نشأ بموجب التنظيم بنك يسمى بنك (التصدير والاستيراد السعودي)، ويرتبط تنظيمياً بصندوق التنمية الوطني، ويتمتع بالشخصية الاعتبارية المستقلة والاستقلال المالي والإداري، ويباشر المهمات والاختصاصات المنوطة به بموجب التنظيم. 

يكون مقر البنك الرئيس في مدينة الرياض، وللبنك -بقرار من المجلس- إنشاء فروع أو مكاتب له داخل المملكة أو خارجها. ' body,'2022-04-05'::timestamptz valid_from,'قرار مجلس الوزراء رقم 508 وتاريخ 1443/9/4هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/017d722d-4f95-4acd-be8c-ab6c00eb3f90/1' eu,'- تعديل الفقرة (1) من هذه المادة وذلك بإحلال عبارة "ويرتبط تنظيمياً بصندوق التنمية الوطني" محل عبارة "يحدد ارتباطه بأمر من رئيس مجلس الوزراء"، لتكون بالنص الآتي: "ينشأ بموجب التنظيم بنك يسمى بنك (التصدير والاستيراد السعودي)، ويرتبط تنظيمياً بصندوق التنمية الوطني، ويتمتع بالشخصية الاعتبارية المستقلة والاستقلال المالي والإداري، ويباشر المهمات والاختصاصات المنوطة به بموجب التنظيم". وذلك بموجب قرار مجلس الوزراء رقم (508) وتاريخ 1443/9/4هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2b0a2ed4ebeecb7c7bc12747d0ca4e41'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvci40busvtrkntz8mg8j') = '95baece1cb426d0f272e3ffb09487acd'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvci40busvtrkntz8mg8j' AND valid_from='2022-04-05'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-064882aa6f8045019eb2b245' id,'cmpzcv89r0anhvtrkyghepzgt' unit_id,'للوزارة أن تمتنع عن تجديد رخصة العمل متى خالف صاحب العمل المعايير الخاصة بتوطين الوظائف التي تضعها الوزارة.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي :

"للوزارة أن تمتنع عن تجديد رخصة العمل متى خالف صاحب العمل المعايير الخاصة بتوطين الوظائف التي تضعها الوزارة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '21f9f72a7322c60c67556d5564466353'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anhvtrkyghepzgt') = 'd88e39bb61bd5c69a5abc0c51499ec83'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anhvtrkyghepzgt' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-747ad045ce2475ee1f012aa2' id,'cmpzcv89r0anhvtrkyghepzgt' unit_id,'للوزارة -لاعتبارات تقدرها- أن تمتنع عن تجديد رخصة العمل متى خالف صاحب العمل المعايير الخاصة بتوطين الوظائف التي تضعها الوزارة، وأيًّا من الاشتراطات أو الضوابط الأخرى الواردة في اللائحة. وتبين اللائحة الإجراءات التي تكفل عدم تأثر العامل من عدم تجديد رخصة العمل، بما في ذلك إمكانية نقل خدمة العامل إلى صاحب عمل آخر دون موافقة صاحب العمل المخالف.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "للوزارة -لاعتبارات تقدرها- أن تمتنع عن تجديد رخصة العمل متى خالف صاحب العمل المعايير الخاصة بتوطين الوظائف التي تضعها الوزارة، وأيًّا من الاشتراطات أو الضوابط الأخرى الواردة في اللائحة. وتبين اللائحة الإجراءات التي تكفل عدم تأثر العامل من عدم تجديد رخصة العمل، بما في ذلك إمكانية نقل خدمة العامل إلى صاحب عمل آخر دون موافقة صاحب ال' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '9d22a7b722c457f44767d27bfb9dbc9d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anhvtrkyghepzgt') = 'd88e39bb61bd5c69a5abc0c51499ec83'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anhvtrkyghepzgt' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-a9c475e660a5eb28fe48b1fb' id,'cmpzcv89r0anjvtrk0iugub3r' unit_id,'يجب أن يكون عقد عمل غير السعودي مكتوباً ومحدد المدة. وإذا خلا العقد من بيان مدته تعد مدته (سنة) من تاريخ مباشرة العامل الفعلية، وإذا استمر العمل بعد انتهاء هذه المدة، عُدَّ متجدداً لمدة مماثلة.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يجب أن يكون عقد عمل غير السعودي مكتوباً ومحدد المدة. وإذا خلا العقد من بيان مدته تعد مدته (سنة) من تاريخ مباشرة العامل الفعلية، وإذا استمر العمل بعد انتهاء هذه المدة، عُدَّ متجدداً لمدة مماثلة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'fc669ea8dc8cc1693441326b1660edd4'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anjvtrk0iugub3r') = '487fe97868e3c5704661928fae849539'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anjvtrk0iugub3r' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-47e80d2b0733e7c71c912a83' id,'cmpzcv89r0anmvtrkbiu0xkex' unit_id,'1 - يتحمل صاحب العمل رسوم استقدام العامل غير السعودي، ورسوم الإقامة ورخصة العمل وتجديدهما، وما يترتب على تأخير ذلك من غرامات يتسبب بها صاحب العمل، ورسوم تغيير المهنة، والخروج والعودة، وتذكرة عودة العامل إلى موطنه بعد انتهاء العلاقة بين الطرفين
2 - يتحمل العامل تكاليف عودته إلى بلده في حالة عدم صلاحيته للعمل أو إذا رغب في العودة دون سبب مشروع.
3 - يتحمل   صاحب العمل    رسوم نقل خدمات العامل الذي يرغب في نقل خدماته إليه.
4 - يلزم   صاحب العمل    بنفقات تجهيز جثمان العامل ونقله إلى الجهة التي أبرم فيها العقد أو استقدم العامل منها، ما لم يدفن بموافقة ذويه داخل المملكة، ويعفى   صاحب العمل    في حالة التزام المؤسسة العامة للتأمينات الاجتماعية بذلك.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) من هذه المادة لتكون بالنص الآتي: "يتحمل صاحب العمل رسوم استقدام العامل غير السعودي، ورسوم الإقامة ورخصة العمل وتجديدهما، وما يترتب على تأخير ذلك من غرامات يتسبب بها صاحب العمل، ورسوم تغيير المهنة، والخروج والعودة، وتذكرة عودة العامل إلى موطنه بعد انتهاء العلاقة بين الطرفين".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '71cdcf5b472bc422f3bd80384e534097'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anmvtrkbiu0xkex') = '3d684c23a9d039e17fba514302766e47'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anmvtrkbiu0xkex' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-9b02dbce2a3ad12600d5349c' id,'cmpzcv89r0anovtrk8pvm1pmb' unit_id,'على كل صاحب عمل وضع سياسة لتدريب عماله السعوديين وتأهيلهم، من أجل رفع مهاراتهم وتحسين مستواهم في الأعمال الفنية والإدارية والمهنية وغيرها. وتحدد اللائحة الأحكام المتصلة بذلك.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "على كل صاحب عمل وضع سياسة لتدريب عماله السعوديين وتأهيلهم، من أجل رفع مهاراتهم وتحسين مستواهم في الأعمال الفنية والإدارية والمهنية وغيرها. وتحدد اللائحة الأحكام المتصلة بذلك".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'c002847e27700f7a4d41055cfdcddbfd'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anovtrk8pvm1pmb') = '7e9e3c3abf436270bd2ce236a0253a21'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anovtrk8pvm1pmb' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-f68a76088b3711c8bbef7b0a' id,'cmpzcv89r0anpvtrkw4xyj69v' unit_id,'مع عدم الإخلال بما تنص عليه اتفاقيات الامتياز وغيرها من الاتفاقيات من شروط وقواعد خاصة بالتدريب والتأهيل؛ على كل صاحب عمل يشغّل خمسين عاملاً فأكثر أن يؤهل أو يدرب على أعماله من عماله السعوديين ما لا يقل عن (12%) من مجموع عماله سنوياً، ويدخل ضمن هذه النسبة العمال السعوديون الذين يكملون دراساتهم إذا كان صاحب العمل يتحمل تكاليف الدراسة. وللوزير أن يرفع هذه النسبة في بعض المنشآت التي يحددها بقرار منه.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي :

"مع عدم الإخلال بما تنص عليه اتفاقيات الامتياز وغيرها من الاتفاقيات من شروط وقواعد خاصة بالتدريب والتأهيل؛ على كل صاحب عمل يشغّل خمسين عاملاً فأكثر أن يؤهل أو يدرب على أعماله من عماله السعوديين ما لا يقل عن (12%) من مجموع عماله سنوياً، ويدخل ضمن هذه النسبة العمال السعوديون الذين يكملون دراساتهم إذا كان صاحب العمل يتحمل تكاليف الدراسة. وللوزير أن يرفع هذه النسبة في بعض المنشآت التي يحددها بقرار منه' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '62a50a9e1157bb0c20bc7bf93d629f0c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anpvtrkw4xyj69v') = '2ce2f97aab90517dda14679e2923b31b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anpvtrkw4xyj69v' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-eb4646a559be12b6c5482bd3' id,'cmpzcv89r0anpvtrkw4xyj69v' unit_id,'دون إخلال بما تنص عليه اتفاقيات الامتياز وغيرها من الاتفاقيات من شروط وقواعد خاصة بالتدريب والتأهيل ورفع المهارات؛ على كل صاحب عمل أن يؤهل أو يدرب على أعماله من عماله السعوديين الذين يكملون دراساتهم إذا كان صاحب العمل يتحمل تكاليف الدراسة. وتحدد اللائحة المعايير والأحكام العامة المتصلة بذلك.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "دون إخلال بما تنص عليه اتفاقيات الامتياز وغيرها من الاتفاقيات من شروط وقواعد خاصة بالتدريب والتأهيل ورفع المهارات؛ على كل صاحب عمل أن يؤهل أو يدرب على أعماله من عماله السعوديين الذين يكملون دراساتهم إذا كان صاحب العمل يتحمل تكاليف الدراسة. وتحدد اللائحة المعايير والأحكام العامة المتصلة بذلك".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '6ae41bfba74892bd287eaf6e98c225d4'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anpvtrkw4xyj69v') = '2ce2f97aab90517dda14679e2923b31b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anpvtrkw4xyj69v' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-25b880e29cc09264e029d0ee' id,'cmpzcv89t0as0vtrkp3lo8o26' unit_id,'يحق  لمفتشي  العمل   :
1- دخول أي منشأة خاضعة لأحكام نظام العمل في أي وقت من أوقات عمل المنشأة دون إشعار سابق
2 - القيام بأي فحص أو تحقيق لازم للتحقق من سلامة تنفيذ النظام، ولهم على الأخص ما يأتي :

أ - سؤال   صاحب العمل    أو من يمثله، أو العمال، على انفراد أو في حضور شهود، عن أي أمر من الأمور المتعلقة بتنفيذ أحكام النظام.
ب - الاطلاع على جميع الدفاتر والسجلات والوثائق الأخرى اللازم الاحتفاظ بها طبقًا لأحكام هذا النظام والقرارات الصادرة بمقتضاه، والحصول على صور ومستخرجات منها.
ج - أخذ عينة أو عينات من المواد المستعملة أو المتداولة في العمليات الصناعية وغيرها الخاضعة للتفتيش، مما يظن أن لها أثرًا ضارًّا على صحة العمال أو سلامتهم، وذلك لغرض تحليلها في المختبرات الحكومية، ولمعرفة مدى هذا الأثر، مع إبلاغ   صاحب العمل  أو ممثله بذلك.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) من هذه المادة لتكون بالنص الآتي: "دخول أي منشأة خاضعة لأحكام نظام العمل في أي وقت من أوقات عمل المنشأة دون إشعار سابق".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '7f06fba4a4215bc05457dc9a47f43121'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0as0vtrkp3lo8o26') = '8c6e2d96a059491261b247cb5f4d2621'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0as0vtrkp3lo8o26' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-a638f3928c75025024ad5cce' id,'cmpzcv89r0anqvtrk0hdyhedf' unit_id,'يجب أن يشتمل برنامج التدريب على المهارة التي يتدرب العامل عليها والقواعد والشروط التي تتبع في التدريب، وعلى مدته وعدد ساعاته والبرامج التدريبية النظرية والعملية، وطريقة الاختبار والشهادات التي تمنح في هذا الشأن. وتحدد اللائحة المعايير والقواعد العامة التي ينبغي اتباعها بهذا الخصوص لرفع مستوى أداء العامل من حيث المهارة والإنتاجية.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يجب أن يشتمل برنامج التدريب على المهارة التي يتدرب العامل عليها والقواعد والشروط التي تتبع في التدريب، وعلى مدته وعدد ساعاته والبرامج التدريبية النظرية والعملية، وطريقة الاختبار والشهادات التي تمنح في هذا الشأن. وتحدد اللائحة المعايير والقواعد العامة التي ينبغي اتباعها بهذا الخصوص لرفع مستوى أداء العامل من حيث المهارة والإنتاجية"' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '76daac8c33c418551882effa445c149d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anqvtrk0hdyhedf') = 'bbe6fa18207a86a0e929decd99762c1b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anqvtrk0hdyhedf' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-69309af58125c3edfc3402b9' id,'cmpzcv89r0ansvtrkz39k354v' unit_id,'يجب أن يكون عقد التأهيل أو التدريب مكتوباً، وأن يحدد فيه نوع المهنة المتعاقد للتدريب عليها، ومقدار المكافأة التي تعطى للمتدرب في كل مرحلة، على ألا يكون تحديدها على أساس القطعة أو الإنتاج، ويجب أن تُبيَّن في العقد حقوق المتدرب وصاحب العمل وواجباتهما، وما إذا كان التأهيل أو التدريب في منشأة تتبع صاحب العمل أو لدى منشأة أخرى.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يجب أن يكون عقد التأهيل أو التدريب مكتوباً، وأن يحدد فيه نوع المهنة المتعاقد للتدريب عليها، ومقدار المكافأة التي تعطى للمتدرب في كل مرحلة، على ألا يكون تحديدها على أساس القطعة أو الإنتاج، ويجب أن تُبيَّن في العقد حقوق المتدرب وصاحب العمل وواجباتهما، وما إذا كان التأهيل أو التدريب في منشأة تتبع صاحب العمل أو لدى منشأة أخرى".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '8712d7d99cb79fead449645da4473962'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0ansvtrkz39k354v') = '4da4c9a042fe8598d4a79c8c00971a49'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0ansvtrkz39k354v' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-6fd9c3d5cbcbeeeb13b5b0d0' id,'cmpzcv89r0antvtrkg6xaloqt' unit_id,'للوزير أن يلزم المنشآت بقبول عدد أو تنسبة محددة من طلاب الجامعات والكليات والمعاهد والمراكز وخريجيها؛ بغية التدريب واستكمال الخبرة العملية، وفق الشروط والأوضاع والمدد التي تحددها اللائحة، على أن يُبرم عقد تدريب بين المتدرب وصاحب العمل تطبق في شأنه الأحكام الواردة في هذا الفصل. وللمنشأة أن تقدم مكافأة للمتدرب.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "للوزير أن يلزم المنشآت بقبول عدد أو تنسبة محددة من طلاب الجامعات والكليات والمعاهد والمراكز وخريجيها؛ بغية التدريب واستكمال الخبرة العملية، وفق الشروط والأوضاع والمدد التي تحددها اللائحة، على أن يُبرم عقد تدريب بين المتدرب وصاحب العمل تطبق في شأنه الأحكام الواردة في هذا الفصل. وللمنشأة أن تقدم مكافأة للمتدرب".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f1b91ac78b23efb60f119d46b77e6d2d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0antvtrkg6xaloqt') = '4beafb8e3088b64339ba523a46e8dee3'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0antvtrkg6xaloqt' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-e7e6f1402eddf7d9d3df5e22' id,'cmpzcv89r0anuvtrkkgk69ho0' unit_id,'1 - لصاحب العمل أن ينهي عقد التأهيل أو التدريب إذا ثبت له عدم قابلية أو قدرة المتدرب أو الخاضع للتأهيل على إكمال برامج التدريب أو التأهيل بصورة مفيدة، وللمتدرب أو الخاضع للتأهيل أو وليه أو وصيه مثل هذا الحق. وعلى الطرف الذي يرغب في إنهاء العقد إبلاغ الطرف الآخر بذلك قبل أسبوع على الأقل من تاريخ التوقف عن التدريب أو التأهيل.

2 - لصاحب العمل - بعد إكمال مدة التدريب أو التأهيل - أن يلزم المتدرب أو الخاضع للتأهيل بأن يعمل لديه مدة مماثلة لمدة التدريب أو التأهيل، فإن رفض أو امتنع المتدرب أو الخاضع للتأهيل عن العمل المدة المماثلة أو بعضها؛ وجب عليه أن يدفع لصاحب العمل تكاليف التدريب أو التأهيل التي تحملها صاحب العمل أو بنسبة المدة الباقية منها.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي :

"1 - لصاحب العمل أن ينهي عقد التأهيل أو التدريب إذا ثبت له عدم قابلية أو قدرة المتدرب أو الخاضع للتأهيل على إكمال برامج التدريب أو التأهيل بصورة مفيدة، وللمتدرب أو الخاضع للتأهيل أو وليه أو وصيه مثل هذا الحق. وعلى الطرف الذي يرغب في إنهاء العقد إبلاغ الطرف الآخر بذلك قبل أسبوع على الأقل من تاريخ التوقف عن التدريب أو التأهيل.

2 - لصاحب العمل - بعد إكمال مدة التدريب أو التأهيل - أن يلزم المتدرب أو ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'a994e9d4cef90f0100d3b574b46d406f'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anuvtrkkgk69ho0') = 'd6d213e0ac282f0479f21df5bb93a445'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anuvtrkkgk69ho0' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8aa064f147ec0f493950fec9' id,'cmpzcv89r0anuvtrkkgk69ho0' unit_id,'1 - لصاحب العمل أن ينهي عقد التأهيل أو التدريب إذا ثبت له عدم قابلية أو قدرة المتدرب أو الخاضع للتأهيل على إكمال برامج التدريب أو التأهيل بصورة مفيدة، وفقاً لتقارير تقويم دورية تضعها المنشأة التي تقدم التدريب أو التأهيل. وللمتدرب أو الخاضع للتأهيل الحق في إنهاء العقد. وعلى الطرف الذي يرغب في إنهاء العقد إبلاغ الطرف الآخر برغبته في ذلك قبل (أسبوع) على الأقل من التاريخ المحدد للإنهاء، وليس لأي من الطرفين أن يطالب الطرف الآخر بالتعويض إلا إذا تضمن العقد حكماً يقضي بذلك

2 - لصاحب العمل - بعد إكمال مدة التدريب أو التأهيل - أن يلزم المتدرب أو الخاضع للتأهيل بأن يعمل لديه مدة مماثلة لمدة التدريب أو التأهيل، فإن رفض أو امتنع المتدرب أو الخاضع للتأهيل عن العمل المدة المماثلة أو بعضها؛ وجب عليه أن يدفع لصاحب العمل تكاليف التدريب أو التأهيل التي تحملها صاحب العمل أو بنسبة المدة الباقية منها.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) هذه المادة لتكون بالنص الآتي: "لصاحب العمل أن ينهي عقد التأهيل أو التدريب إذا ثبت له عدم قابلية أو قدرة المتدرب أو الخاضع للتأهيل على إكمال برامج التدريب أو التأهيل بصورة مفيدة، وفقاً لتقارير تقويم دورية تضعها المنشأة التي تقدم التدريب أو التأهيل. وللمتدرب أو الخاضع للتأهيل الحق في إنهاء العقد. وعلى الطرف الذي يرغب في إنهاء العقد إبلاغ الطرف الآخر ب' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '1b9d4282006593b548310e4863c01e95'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anuvtrkkgk69ho0') = 'd6d213e0ac282f0479f21df5bb93a445'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anuvtrkkgk69ho0' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-991fbb6748b62d7b4d605625' id,'cmpzcv89r0anxvtrklbeocgxx' unit_id,'يجب أن يكتب عقد العمل من نسختين، يحتفظ كل من طرفيه بنسخة منه، ويجب توثيقه وفق الأحكام النظامية ذات الصلة وفي ضوء ما تحدده اللائحة، ويعد العقد قائماً ولو كان غير مكتوب، وفي هذه الحالة يجوز للعامل وحده إثبات العقد وحقوقه التي نشأت عنه بجميع طرق الإثبات، ويكون لكل من الطرفين أن يطلب كتابة العقد في أي وقت. أما عمال الحكومة والمؤسسات العامة فيقوم قرار أو أمر التعيين الصادر من الجهة المختصة مقام العقد.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يجب أن يكتب عقد العمل من نسختين، يحتفظ كل من طرفيه بنسخة منه، ويجب توثيقه وفق الأحكام النظامية ذات الصلة وفي ضوء ما تحدده اللائحة، ويعد العقد قائماً ولو كان غير مكتوب، وفي هذه الحالة يجوز للعامل وحده إثبات العقد وحقوقه التي نشأت عنه بجميع طرق الإثبات، ويكون لكل من الطرفين أن يطلب كتابة العقد في أي وقت. أما عمال الحكومة والمؤسسات ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'c40dd7fec216767575c8de45c2370814'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anxvtrklbeocgxx') = '565bfcc16a100715c48d44af25d7e029'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anxvtrklbeocgxx' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-4f3c3845cbbfd3f96cd48e75' id,'cmpzcv89r0anzvtrk2g05zwvu' unit_id,'إذا كان العامل خاضعاً لفترة تجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديدها بوضوح، بحيث لا تزيد على تسعين يوماً. ويجوز باتفاق مكتوب بين العامل وصاحب العمل تمديد فترة التجربة، على ألا تزيد على مائة وثمانين يوماً. ولا تدخل في حساب فترة التجربة إجازة عيدي الفطر والأضحى والإجازة المرضية. ولكل من الطرفين الحق في إنهاء العقد خلال هذه الفترة ما لم يتضمن العقد نصّا يعطي الحق في الإنهاء لأحدهما.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي :

"إذا كان العامل خاضعاً لفترة تجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديدها بوضوح، بحيث لا تزيد على تسعين يوماً. ويجوز باتفاق مكتوب بين العامل وصاحب العمل تمديد فترة التجربة، على ألا تزيد على مائة وثمانين يوماً. ولا تدخل في حساب فترة التجربة إجازة عيدي الفطر والأضحى والإجازة المرضية. ولكل من الطرفين الحق في إنهاء العقد خلال هذه الفترة ما لم يتضمن العقد نصّا يعطي الحق في الإنهاء لأحدهما".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '72a411131476e24b5ce7cf760ab25183'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anzvtrk2g05zwvu') = 'e1d6aea6cc4e4b7a3a87bf2ff8ae5a2a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anzvtrk2g05zwvu' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-28862e7a5377d7b656ba1beb' id,'cmpzcv89r0anzvtrk2g05zwvu' unit_id,'إذا كان العامل خاضعاً للتجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديد مدتها بوضوح، على ألا يزيد مجموع المدة في جميع الأحوال على (مائة وثمانين) يوماً. وتبين اللائحة الأحكام المتصلة بذلك بما في ذلك ما يتعلق بالإجازات التي لا تدخل في حساب المدة. ولكل من الطرفين الحق في إنهاء العقد خلال هذه المدة.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "إذا كان العامل خاضعاً للتجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديد مدتها بوضوح، على ألا يزيد مجموع المدة في جميع الأحوال على (مائة وثمانين) يوماً. وتبين اللائحة الأحكام المتصلة بذلك بما في ذلك ما يتعلق بالإجازات التي لا تدخل في حساب المدة. ولكل من الطرفين الحق في إنهاء العقد خلال هذه المدة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '392d39e20ea649b20265095417454f5d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anzvtrk2g05zwvu') = 'e1d6aea6cc4e4b7a3a87bf2ff8ae5a2a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anzvtrk2g05zwvu' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-6743f21864ae6b5a0653fb58' id,'cmpzcv89r0aoivtrk48xlqkhf' unit_id,'يجب أن يبلغ العامل بقرار توقيع الجزاء عليه كتابة، فإذا امتنع عن الاستلام أو كان غائباً فيرسل البلاغ بكتاب مسجل على عنوانه المبين في ملفه، وله التظلم كتابة للجهة المختصة لدى صاحب العمل خلال (ثلاثين) يوماً -عدا أيام العطل الرسمية- من تاريخ إبلاغه بالقرار، فإن رُفض تظلمه أو لم يُبت فيه كتابة خلال (خمسة عشر) يوماً من تقديمه كان له حق الاعتراض أمام المحاكم العمالية على القرار الخاص بتوقيع الجزاء عليه خلال (ثلاثين) يوماً -عدا أيام العطل الرسمية- من تاريخ رفض تظلمه أو انتهاء المدة المحددة للبت في التظلم أيهما أقرب.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "يجب أن يبلغ العامل بقرار توقيع الجزاء عليه كتابة، فإذا امتنع عن الاستلام أو كان غائباً فيرسل البلاغ بكتاب مسجل على عنوانه المبين في ملفه، وله التظلم كتابة للجهة المختصة لدى صاحب العمل خلال (ثلاثين) يوماً -عدا أيام العطل الرسمية- من تاريخ إبلاغه بالقرار، فإن رُفض تظلمه أو لم يُبت فيه كتابة خلال (خمسة عشر) يوماً من تقديمه كان له حق' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '6c2448354189b9f36f5f8ab317b3d474'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0aoivtrk48xlqkhf') = '26b856b0af91d978658389681e593d6e'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0aoivtrk48xlqkhf' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-bed544611fbd7110f26ad712' id,'cmpzcv89s0aolvtrk4sskedrt' unit_id,'إذا كان العقد غير محدد المدة، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع يجب بيانه بموجب إشعار يوجه إلى الطرف الآخر كتابةً قبل الإنهاء بمدة تحدد في العقد، على ألا تقل عن ستين يوماً إذا كان أجر العامل يدفع شهريًّا، ولا تقل عن ثلاثين يوماً بالنسبة إلى غيره.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي:

"إذا كان العقد غير محدد المدة، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع يجب بيانه بموجب إشعار يوجه إلى الطرف الآخر كتابةً قبل الإنهاء بمدة تحدد في العقد، على ألا تقل عن ستين يوماً إذا كان أجر العامل يدفع شهريًّا، ولا تقل عن ثلاثين يوماً بالنسبة إلى غيره".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '1558d63f70227fefc5167b1441bf16c2'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89s0aolvtrk4sskedrt') = '57e1737eaee1290c23e7642b9be51689'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89s0aolvtrk4sskedrt' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-d04753e5dc7991f9f5cf9f2d' id,'cmpzcv89s0aolvtrk4sskedrt' unit_id,'1- إذا كان العقد غير محدد المدة وكان الأجر يدفع شهريًّا، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع، وفق ما يلي:

أ- إذا كان الإنهاء من طرف العامل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك لصاحب العمل قبل (ثلاثين) يوماً على الأقل من تاريخ الإنهاء.

ب- إذا كان الإنهاء من طرف صاحب العمل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك للعامل قبل (ستين) يوماً على الأقل من تاريخ الإنهاء.

2- إذا كان العقد غير محدد المدة وكان الأجر لا يدفع شهريًّا، فيجب أن يوجه الطرف الذي سيُنهي العقد بناءً على سبب مشروع -سواء كان العامل أو صاحب العمل- إشعاراً كتابيًّا بذلك للطرف الآخر قبل (ثلاثين) يوماً على الأقل من تاريخ الإنهاء.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي:

"1- إذا كان العقد غير محدد المدة وكان الأجر يدفع شهريًّا، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع، وفق ما يلي:

أ- إذا كان الإنهاء من طرف العامل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك لصاحب العمل قبل (ثلاثين) يوماً على الأقل من تاريخ الإنهاء.

ب- إذا كان الإنهاء من طرف صاحب العمل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك للع' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '9bdb925346d859db87547da38a79a20c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89s0aolvtrk4sskedrt') = '57e1737eaee1290c23e7642b9be51689'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89s0aolvtrk4sskedrt' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0834d509422efac0b0688d40' id,'cmpzcv89s0aphvtrk829m6eux' unit_id,'1- يجب على صاحب العمل أن يدفع للعامل أجراً إضافيًّا عن ساعات العمل الإضافية يوازي أجر الساعة مضافاً إليه (50%) من أجره الأساسي، ويجوز لصاحب العمل بموافقة العامل أن يحتسب للعامل أيام إجازة تعويضية مدفوعة الأجر بدلاً عن الأجر المستحق للعامل لساعات العمل الإضافية. وتبين اللائحة الأحكام المتصلة بذلك
2 - إذا كان التشغيل في   المنشأة    على أساس المعيار الأسبوعي  لساعات العمل    تعد الساعات التي تزيد على الساعات المتخذة لهذا المعيار ساعات عمل إضافية .
3 - تعد جميع   ساعات العمل    التي تؤدَّى في أيام العطل  والأعياد    ساعات إضافية.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) من هذه المادة لتكون بالنص الآتي: "يجب على صاحب العمل أن يدفع للعامل أجراً إضافيًّا عن ساعات العمل الإضافية يوازي أجر الساعة مضافاً إليه (50%) من أجره الأساسي، ويجوز لصاحب العمل بموافقة العامل أن يحتسب للعامل أيام إجازة تعويضية مدفوعة الأجر بدلاً عن الأجر المستحق للعامل لساعات العمل الإضافية. وتبين اللائحة الأحكام المتصلة بذلك".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'da93440dfea503ec5138c475b573742a'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89s0aphvtrk829m6eux') = 'd144188ca75949c222c4488627e03c28'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89s0aphvtrk829m6eux' AND valid_from='2025-02-19'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b40d6a5ffac2989299a13ea4' id,'cmpzcv89s0apnvtrkay56epfe' unit_id,'مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة خمسة أيام في حالة وفاة زوجه أو أحد أصوله أو فروعه، أو عند زواجه، وثلاثة أيام في حالة ولادة مولود له. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة للحالات المشار إليها.' body,'2015-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'تم تعديل هذه المادة بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ ؛ لتكون بالنص الآتي:

"مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة خمسة أيام في حالة وفاة زوجه أو أحد أصوله أو فروعه، أو عند زواجه، وثلاثة أيام في حالة ولادة مولود له. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة للحالات المشار إليها".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '8c107ebf3cf45eede084ac26930b0f30'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89s0apnvtrkay56epfe') = 'cc645a044a667d848d32a163ae673573'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89s0apnvtrkay56epfe' AND valid_from='2015-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-46ac42cc96215c6236bb66ae' id,'cmpzcv89s0apnvtrkay56epfe' unit_id,'مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة (خمسة) أيام عند زواجه، أو في حالة وفاة زوجه أو أحد أصوله أو فروعه، و(ثلاثة) أيام في حالة وفاة الأخ أو الأخت؛ تحتسب جميعها من تاريخ الواقعة. و(ثلاثة) أيام في حالة ولادة مولود له خلال (سبعة) أيام من تاريخ الولادة. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة لهذه الحالات.' body,'2025-02-19'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت هذه المادة لتكون بالنص الآتي: "مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة (خمسة) أيام عند زواجه، أو في حالة وفاة زوجه أو أحد أصوله أو فروعه، و(ثلاثة) أيام في حالة وفاة الأخ أو الأخت؛ تحتسب جميعها من تاريخ الواقعة. و(ثلاثة) أيام في حالة ولادة مولود له خلال (سبعة) أيام من تاريخ الولادة. ويحق لصاحب العمل أن يطلب ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '8a574d0f81c1f96d8460de48036b76e8'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89s0apnvtrkay56epfe') = 'cc645a044a667d848d32a163ae673573'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89s0apnvtrkay56epfe' AND valid_from='2025-02-19'::timestamptz);
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
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-9a479551c98176be1cfa0007' id,'cmpzcv6870a4ovtrk5k1hmi4c' unit_id,'يجوز تضمين القرار الصادر بتحديد العقوبة النص على نشر ملخصه على نفقة المخالف في إحدى الصحف المحلية، أو في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة، وجسامتها، وتأثيرها على المجتمع، على أن يكون نشر القرار بعد تحصنه بمضي المدة المحددة نظاماً، أو تأييده من المحكمة المختصة.' body,'2019-05-22'::timestamptz valid_from,'مرسوم ملكي رقم م/110 وتاريخ 17/9/1440هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'•المادة التاسعة عشرة

-عُدلت هذه المادة بموجب المرسوم الملكي رقم (م/110) وتاريخ 17 /9 /1440هـ، لتكون بالنص الآتي: "يجوز تضمين القرار الصادر بتحديد العقوبة النص على نشر ملخصه على نفقة المخالف في إحدى الصحف المحلية، أو في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة، وجسامتها، وتأثيرها على المجتمع، على أن يكون نشر القرار بعد تحصنه بمضي المدة المحددة نظاماً، أو تأييده من المحكمة المختصة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2102c3038dff7c10feb4df52807bd382'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a4ovtrk5k1hmi4c') = '05a2a27acde63e6fcdfed8b6db96852b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a4ovtrk5k1hmi4c' AND valid_from='2019-05-22'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-77f32ed9e8589bc56be77607' id,'cmpzcv6870a4ovtrk5k1hmi4c' unit_id,'يجوز تضمين الحكم أو القرار الصادر بالعقوبة -بحسب الأحوال- النص على نشر منطوقه على نفقة المخالف في صحيفة محلية تصدر في مقر إقامته، فإن لم يكن في مقر إقامته صحيفة ففي أقرب منطقة إليه، أو نشره في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة وجسامتها وتأثيرها، على أن يكون النشر بعد اكتساب الحكم الصفة النهائية، أو تحصن القرار بفوات ميعاد التظلم منه، أو صدور حكم نهائي برفض التظلم' body,'2025-09-30'::timestamptz valid_from,'مرسوم ملكي رقم م/87 وتاريخ 1446/4/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0f54d227-1450-4231-93cd-a9a700f29821/1' eu,'- صدر المرسوم الملكي رقم (م/87) بتاريخ 1446/4/3هـ بتعديل هذه المادة، ويعمل بالتعديل من تاريخ 1447/4/8هـ، لتصبح بالنص الآتي:

"يجوز تضمين الحكم أو القرار الصادر بالعقوبة -بحسب الأحوال- النص على نشر منطوقه على نفقة المخالف في صحيفة محلية تصدر في مقر إقامته، فإن لم يكن في مقر إقامته صحيفة ففي أقرب منطقة إليه، أو نشره في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة وجسامتها وتأثيرها، على أن يكون النشر بعد اكتساب الحكم الصفة النهائية، أو تحصن القرار بفوات ميعاد التظلم منه، أو صدور حكم نهائي ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd3d6c1e574e47e40e610efbe699f6078'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a4ovtrk5k1hmi4c') = '05a2a27acde63e6fcdfed8b6db96852b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a4ovtrk5k1hmi4c' AND valid_from='2025-09-30'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-47b652da6facdd6ca358856e' id,'cmpz6mj6h0ag7cwg2ne6b1cze' unit_id,'يكون  وزير التخطيط    مسؤولا عن إجراء هذا التعداد، بواسطة   مصلحة الإحصاءات العامة     التابعة    لوزارة التخطيط   ، ويكون له صرف التعويضات والمكافآت وإبرام العقود في حدود ما يقتضيه الأمر دون تقيد بأحكام   نظام الموظفين العام     أو الأنظمة المالية.' body,'1998-12-14'::timestamptz valid_from,'قرار مجلس الوزراء رقم 176 وتاريخ 25/8/1419هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0fceb9eb-d143-4d87-8a47-a9a700f20f2e/1' eu,'حلت عبارة ( وزارة التخطيط )  محل عبارة  ( وزارة المالية والاقتصاد الوطني )،

وعبارة ( وزير التخطيط ) محل عبارة  (وزير المالية والاقتصاد الوطني )، حيثما وردت فى النظام ،

وذلك بموجب قرار مجلس الوزراء رقم (176) وتاريخ 25 / 8 / 1419 هـ .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '19987e8910d99359b6e26e5bed74b27d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6mj6h0ag7cwg2ne6b1cze') = 'a7853adb946c08ef18c1e8b18ed0b8c4'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6mj6h0ag7cwg2ne6b1cze' AND valid_from='1998-12-14'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-fc1b3dc2223c9fdb4ace440b' id,'cmpz6qx1l0byvcwg2wjrejsjd' unit_id,'يتكون المجلس من:

رئيس مجلس الوزراء    	  رئيساً

نائب رئيس مجلس الوزراء    	                 نائباً للرئيس

وزير الدفاع والطيران     والمفتش العام            عضواً

وزير الداخلية     عضواً

وزير المالية والاقتصاد الوطني     عضواً

رئيس الاستخبارات العامة    عضواً

رئيس هيئة الأركان العامة   عضواً

مدير الأمن العام       عضواً

رئيس الجهاز العسكري بالحرس الوطني              عضواً

وزير الخارجية               عضواً

الأمين العام لمجلس الأمن الوطني               عضواً' body,'1982-09-04'::timestamptz valid_from,'مرسوم ملكي رقم م/53 وتاريخ 16/11/1402هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/11d3d5b0-dddf-443a-9851-a9a700f23208/1' eu,'عدلت هذه المادة  بالمرسوم الملكي رقم (م/53) وتاريخ 16 / 11 / 1402 هـ  ، كما صدر بشأنها  الأمر الملكي  رقم (أ/217) وتاريخ 27 / 5 / 1403 هـ، وقرار  مجلس الوزراء رقم (212) وتاريخ 24 / 6 / 1428 هـ، لتصبح كالتالى :

يتكون المجلس من:

رئيس مجلس الوزراء    	  رئيساً

نائب رئيس مجلس الوزراء    	                 نائباً للرئيس

وزير الدفاع والطيران     والمفتش العام            عضواً

وزير الداخلية     عضواً

وزير المالية والاقتصاد الوطني     عضواً

رئيس الاستخبارات العامة    عضواً

رئيس هيئة الأركان العام' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'c89da7e51fc738d5a7261b08983814d4'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6qx1l0byvcwg2wjrejsjd') = 'f53848f82b02b62fb642ee385458868b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6qx1l0byvcwg2wjrejsjd' AND valid_from='1982-09-04'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-5bd8b35419f876c99c353dd9' id,'cmpz5uvk70119cwg2x5zhlohw' unit_id,'بالنسبة للمواقع المؤجرة من قبل الجهات الحكومية يجب ألا تزيد مدة التعاقد على استئجارها عن عشر سنوات.' body,'2020-05-05'::timestamptz valid_from,'قرار مجلس الوزراء رقم 590 وتاريخ 1441/9/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/16c49913-599f-406b-b016-a9a700f172c9/1' eu,'-عُدل عجز هذه المادة بموجب قرار مجلس الوزراء رقم (590) وتاريخ 1441/9/12هـ، وذلك بتعديل عبارة "ثلاث سنوات" لتكون "عشر سنوات".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd4243088e67fcfd2d2a84d331ece04b3'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5uvk70119cwg2x5zhlohw') = 'bd975c7e737f64cbfc9a9181b06fca42'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5uvk70119cwg2x5zhlohw' AND valid_from='2020-05-05'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-102bba11fe6921f1cc595692' id,'cmpz639j603tdcwg2igpa8w0y' unit_id,'يكون للهيئة محافظ بالمرتبة الممتازة، يعيّن بناءً على ترشيح الرئيس، ويكون المسؤول التنفيذي عن إدارة الهيئة، وتتركز مسؤولياته في حدود ما ينص عليه التنظيم وما يقرره المجلس، ويمارس المحافظ بوجه خاص الصلاحيات والمهمات الآتية: 

الإشراف على إعداد السياسات العامة المتعلقة بنشاط الهيئة، والخطط والبرامج اللازمة لتنفيذها، ورفعها إلى المجلس، ومتابعة تنفيذها بعد إقرارها.

الإشراف على إعداد الاستراتيجية الوطنية للأمن الصناعي، والخطط والبرامج اللازمة لتنفيذها، وعرضها على المجلس للموافقة عليها. 

الإشراف على إعداد الهيكل التنظيمي للهيئة، ورفعه إلى المجلس.

الإشراف على إعداد اللوائح المالية والإدارية وغيرها من اللوائح الداخلية لقيام الهيئة بمهماتها، ورفعها إلى المجلس.

متابعة تنفيذ القرارات الصادرة عن المجلس.

اقتراح القرارات اللازمة لتنفيذ الأحكام الواردة في التنظيم واللوائح الصادرة بناءً عليه، بحسب الصلاحيات المخولة له.

الإشراف على منسوبي الهيئة وفقاً للصلاحيات المخولة له وما تحدده اللوائح المنظمة لذلك.

تعيين منسوبي الهيئة من المدنيين، وفقاً للوائح المنظمة لذلك.

الإشراف على إعداد تقارير دورية عن أعمال الهيئة ومنجزاتها ونشاطها، ورفعها إلى المجلس.

الإشراف على إعداد خطة عمل الهيئة التشغيلية، ورفعها إلى المجلس، ومتابعة تنفيذها بعد إقرارها.

الصرف من ميزانية الهيئة، واتخاذ جميع الإجراءات المالية وفقاً للأنظمة واللوائح المعمول بها، وفي حدود الصلاحيات التي يفوضه بها المجلس.

الإشراف على إعداد مشروع ميزانية الهيئة وحسابها الختامي وتقرير مراجع الحسابات والتقرير السنوي؛ تمهيداً لرفعها إلى المجلس. 

تمثيل الهيئة أمام القضاء، والجهات الحكومية والمؤسسات والهيئات الأخرى ذات العلاقة، وغيرها من الجهات داخل المملكة وخارجها. وله تفويض غيره بذلك. 

إقرار الخطط والبرامج اللازمة لتدريب وابتعاث وإيفاد منسوبي الهيئة في مجالات عملها، ومتابعة تنفيذها. 

تنظيم مشاركة الهيئة في المؤتمرات والندوات والمعارض المحلية والإقليمية والدولية وفقاً للإجراءات النظامية. 

التوقيع على الاتفاقيات والعقود بعد موافقة المجلس، أو بحسب الصلاحيات التي يمنحه إيّاها المجلس، ووفقاً للإجراءات النظامية المتبعة. 

أي اختصاص آخر يسنده إليه المجلس. 

وللمحافظ تفويض بعض صلاحياته ومهماته إلى من يراه من منسوبي الهيئة. ' body,'2023-04-11'::timestamptz valid_from,'قرار مجلس الوزراء رقم 659 وتاريخ 1444/9/20هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/1ad6bc9a-eec1-4dd4-be16-af34010b4cbd/1' eu,'- تعديل صدر المادة وذلك بموجب قرار مجلس الوزراء رقم (659) وتاريخ 1444/9/20هـ، وذلك بإحلال عبارة "يكون للهيئة محافظ بالمرتبة الممتازة" محل عبارة "يكون للهيئة محافظ بمرتبة وزير".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '906c07500c7885998523364580e3fdd0'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz639j603tdcwg2igpa8w0y') = 'a6116b6dd3164a3cd4c512260d4d469f'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz639j603tdcwg2igpa8w0y' AND valid_from='2023-04-11'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0350286f2b215f172b690d64' id,'cmpzcv9t60b3ovtrko5k49a1w' unit_id,'يهدف المجلس إلى تعزيز مكانة الأسرة ودورها في المجتمع والنهوض بها، والمحافظة على أسرة قوية متماسكة ترعى أبناءها وتلتزم بالقيم الدينية والأخلاقية والمثل العليا، وله في سبيل تحقيق ذلك ممارسة الصلاحيات والاختصاصات اللازمة وعلى الأخص ما يلي:

1   -	إعداد مشروع استراتيجية للأسرة بالتنسيق مع الجهات ذات العلاقة، ورفعه لاستكمال الاجراءات النظامية، ومتابعة تنفيذها وتقويمها بصفة دورية.
2 - العمل على قيام الجهات الحكومية والأهلية ذات العلاقة بالأسرة بأدوارها، وتحقيق غاياتها، والتنسيق بينها؛ لتكوين الرؤية المشتركة للأسرة.
3 - التوعية بحقوق أفراد الأسرة وواجباتهم في الإسلام.
4 - تحديد المشكلات والمخاطر التي تتعرض لها الأسرة، والعمل على وضع الحلول المناسبة لها.
5 - توعية المجتمع بأهمية قضايا الأسرة، وسبل معالجتها.
6 - تشجيع المشاركة الأهلية في الاهتمام بقضايا الأسرة، وطرح الحلول لمعالجتها.
7 - تقديم الرأي للجهات المعنية حيال التقارير الوطنية التي تعد عن الأسرة (الطفولة، والمرأة، وكبار السن) في المملكة.
8 - إبداء الرأي حيال التقارير والدراسات والاستفسارات والتوصيات التي تصدرها الهيئات والمنظمات الإقليمية والدولية حول النشاطات والبرامج المتعلقة بشؤون الأسرة، واقتراح المرئيات والتوصيات في شأنها وذلك دون الإخلال باختصاصات الجهات المعنية.
9 - إبداء المقترحات في شأن التشريعات ذات العلاقة بالأسرة.
10 - إعداد قاعدة معلومات بشؤون الأسرة.
11 - التعاون مع الهيئات والمنظمات الإقليمية والدولية المعنية بشؤون الأسرة، والمشاركة في المؤتمرات والندوات التي تعقد لبحث قضايا الأسرة من خلال اللجان المختصة، بحسب الإجراءات المتبعة.
12 - التعاون مع مراكز البحوث المحلية والعالمية؛ لإجراء البحوث والدراسات المتعلقة بشؤون الأسرة، بحسب الإجراءات المتبعة.
13 - إقرار اللوائح المالية والإدارية التي يسير عليها المجلس، على أن يكون إقرار اللوائح الإدارية بالاتفاق مع وزارة الموارد البشرية والتنمية الاجتماعية، وأن يكون إقرار اللوائح المالية والأحكام ذات الأثر المالي في اللوائح الإدارية بالاتفاق مع وزارة المالية".

- وإضافة فقرة رقمها (15) لهذه المادة، لتكون بالنص الآتي: "15 - إقرار مشروع الميزانية السنوية للمجلس، وحسابه الختامي، وتقرير مراجع الحسابات، والتقرير السنوي، تمهيداً لرفعها بحسب الإجراءات النظامية المتبعة
14 - إقرار الهيكل التنظيمي للمجلس.
15 - قبول الهبات والتبرعات والمنح والوصايا والأوقاف التي تقدم للمجلس.' body,'2022-03-15'::timestamptz valid_from,'قرار مجلس الوزراء رقم 443 وتاريخ 1443/8/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/1c026125-b0b2-4ea7-b374-a9a700f2c0ee/1' eu,'- عدلت الفقرة (13) من هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (443) وتاريخ 1443/8/12هـ، لتكون بالنص الآتي: "إقرار اللوائح المالية والإدارية التي يسير عليها المجلس، على أن يكون إقرار اللوائح الإدارية بالاتفاق مع وزارة الموارد البشرية والتنمية الاجتماعية، وأن يكون إقرار اللوائح المالية والأحكام ذات الأثر المالي في اللوائح الإدارية بالاتفاق مع وزارة المالية".

- وإضافة فقرة رقمها (15) لهذه المادة، لتكون بالنص الآتي: "15 - إقرار مشروع الميزانية السنوية للمجلس، وحسابه الختامي، وتقرير مراجع الحساب' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '10c12aaea1e088db6b88bfe90a13186b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv9t60b3ovtrko5k49a1w') = '42724eb0148db6605c4ed87cd9565aef'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv9t60b3ovtrko5k49a1w' AND valid_from='2022-03-15'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-54ff066de35c2a05aeb46f31' id,'cmpz6nsjy0avxcwg2px0l3fss' unit_id,'1 - لا تنتقل ملكية الوحدة السكنية إلى المستفيد إلا بعد سداد الأقساط المالية كاملة، ويلتزم المستفيد خلال مدة الاستيفاء بالمحافظة عليها وصيانتها.
2 - لا تنتقل ملكية الأرض السكنية إلى المستفيد إلا بعد بناء مسكن عليها وسداد الأقساط المالية كاملةً.
3 - يُقصر انتفاع المستفيد من الدعم السكني على منفعة السكن الخاص له ولأسرته، ويستثنى من ذلك تأجير المسكن وفق الضوابط التي تحددها اللائحة.
4 - لا يجوز التصرف بعوض أو بغير عوض في الدعم السكني إلا بعد مرور خمس سنوات من تاريخ توقيع عقد الدعم السكني، وسداد الأقساط المالية كاملة
5 - يكون باطلاً أي تصرف في الأرض السكنية أو الوحدة السكنية بالمخالفة لأحكام هذه المادة، وللوزارة في هذه الحالة استرداد الدعم السكني بشكل نهائي.
6 - تطبق أحكام الفقرتين (3) و(4) من هذه المادة على المسكن الذي يشتريه المستفيد أو يبنيه باستخدام القرض السكني. وإذا تصرف المستفيد في المسكن بما يخالف ذلك، حل مبلغ القرض كاملاً.
7 - للوزارة أو الصندوق الحصول على الضمانات العينية والشخصية من المستفيد لضمان استيفاء الأقساط المالية.' body,'2025-05-27'::timestamptz valid_from,'قرار مجلس الوزراء رقم 850 وتاريخ 1446/11/29هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/1e29de81-aa5e-4d27-9b90-a9a700f21aed/1' eu,'- عُدلت الفقرة (4) من هذه المادة وذلك بموجب  قرار مجلس الوزراء رقم (850) وتاريخ 1446/11/29هـ، لتكون بالنص الآتي: 

"لا يجوز التصرف بعوض أو بغير عوض في الدعم السكني إلا بعد مرور خمس سنوات من تاريخ توقيع عقد الدعم السكني، وسداد الأقساط المالية كاملة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'acbd036168e652b81d30d0f14e79a1ab'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6nsjy0avxcwg2px0l3fss') = '1435b1599fa01c6c18abdccc6152ca95'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6nsjy0avxcwg2px0l3fss' AND valid_from='2025-05-27'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-9fee71979a9701f14e145e08' id,'cmpz6h33408hvcwg2jbh9kc2o' unit_id,'تكون للهيئة ميزانية سنوية مستقلة ضمن ميزانية الدولة، ويحوَّل الفائض من الموارد المالية التي تتقاضاها الهيئة إلى وزارة المالية بعد اقتطاع جميع النفقات الجارية ونفقات رأس المال وغيرها من المصروفات التي تحتاج إليها الهيئة. .' body,'2019-10-01'::timestamptz valid_from,'قرار مجلس الوزراء رقم 97 وتاريخ 1441/2/2هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/216a2b6e-911e-4223-a11b-adab00c670a1/1' eu,'- حذف عبارة "وتحتفظ الهيئة باحتياطي عام يعادل ضعف إجمالي نفقاتها المبينة في ميزانيتها السنوية السابقة"، الواردة في عجز هذه المادة، وذلك بموجب قرار مجلس الوزراء رقم (97) وتاريخ 1441/2/2هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f17007f7f72fb1a9c50834b04da119f7'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6h33408hvcwg2jbh9kc2o') = '96afa222dbd3627a3d27452242d74e76'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6h33408hvcwg2jbh9kc2o' AND valid_from='2019-10-01'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-d84e0fb48248e65227661d9a' id,'cmpz6h33408hvcwg2jbh9kc2o' unit_id,'تكون للهيئة ميزانية سنوية مستقلة ضمن ميزانية الدولة.' body,'2022-12-27'::timestamptz valid_from,'قرار مجلس الوزراء رقم 376 وتاريخ 1444/6/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/216a2b6e-911e-4223-a11b-adab00c670a1/1' eu,'- عُدلت هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (376) وتاريخ 1444/6/3هـ، لتكون بالنص الآتي:

"تكون للهيئة ميزانية سنوية مستقلة ضمن ميزانية الدولة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '32b5fef654bc1c7b03eb016f69c59b37'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6h33408hvcwg2jbh9kc2o') = '96afa222dbd3627a3d27452242d74e76'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6h33408hvcwg2jbh9kc2o' AND valid_from='2022-12-27'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-c4d26882ba729e893c5198ff' id,'cmpz6h2xq08htcwg2czq1meu4' unit_id,'، يسري على جميع منسوبي الهيئة نظام العمل ونظام التأمينات الاجتماعية.' body,'2021-11-23'::timestamptz valid_from,'قرار مجلس الوزراء رقم 234 وتاريخ 1443/4/18هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/216a2b6e-911e-4223-a11b-adab00c670a1/1' eu,'- حذف عبارة "فيما عدا المحافظ" من صدر المادة لتكون المادة بالنص الآتي: "يسري على جميع منسوبي الهيئة نظام العمل ونظام اتأمينات الاجتماعية". وذلك بموجب قرار مجلس الوزراء رقم (234) وتاريخ 1443/4/18هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '025b7814e687b10760040005674668d9'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6h2xq08htcwg2czq1meu4') = '456c58d29f1d209c058beb9e6a64e87d'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6h2xq08htcwg2czq1meu4' AND valid_from='2021-11-23'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b7070a6b4e5d142d5b20225b' id,'cmpz643xu0437cwg2ov1fq6ss' unit_id,'الهيئة السعودية للمهندسين  هيئة مهنية علمية ذات شخصية اعتبارية وذمة مالية مستقلة تعمل تحت إشراف الجهة التي يصدر بتحديدها أمر من رئيس مجلس الوزراء بناءً على اقتراح من مجلس الشؤون الاقتصادية التنمية  مقرها مدينة الرياض، ويجوز لها أن تنشئ فروعا داخل المملكة، ويعبر عنها بالهيئة في مواد هذا النظام.' body,'2020-09-08'::timestamptz valid_from,'قرار مجلس الوزراء رقم 57 وتاريخ 20/1/1442هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3e1de77d-3cd1-44d8-b174-a9a700f1ab06/1' eu,'- عُّدلت هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (57) وتاريخ 20 / 1 / 1442هـ، وذلك بإحلال عبارة (تعمل تحت إشراف الجهة التي يصدر بتحديدها أمر من رئيس مجلس الوزراء بناءً على اقتراح من مجلس الشؤون الاقتصادية التنمية) محل عبارة ( تعمل تحت إشراف وزارة التجارة ).

 ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f8fd36ac62264fe26e90a7e474815843'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz643xu0437cwg2ov1fq6ss') = 'bc4994c5568bd36de7eaea16f5640715'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz643xu0437cwg2ov1fq6ss' AND valid_from='2020-09-08'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-856e3f3d072e8fc8d628a5f2' id,'cmpz644r4043hcwg2c1etw8fq' unit_id,'1 - يتكون مجلس إدارة الهيئة من عشرة من الأعضاء الأساسيين، تنتخبهم الجمعية العمومية، وتحدد اللائحة التنفيذية الإجراءات اللازمة لذلك وما يشترط في المرشحين، ويتولى مجلس الإدارة المنتخب اختيار رئيس المجلس ونائبه من بين أعضائه بالاقتراع السري.
2 - تكون مدة العضوية ثلاث سنوات قابلة للتجديد مرة واحدة.
3 - يعقد مجلس الإدارة جلسة على الأقل كل ثلاثة أشهر، كما يعقد عندما يطلب ذلك رئيس المجلس، أو أربعة من أعضائه.
4 - تعقد الاجتماعات بحضور أغلبية الأعضاء، على أن يكون من بينهم الرئيس، أو نائبه.
5 - تصدر قرارات المجلس بأغلبية أصوات الحاضرين، فإذا تساوت الأصوات يرجح الجانب الذي صوت معه الرئيس.
6 - يحضر الأمين العام الاجتماع دون أن يكون له حق التصويت.' body,'2005-02-08'::timestamptz valid_from,'مرسوم ملكي رقم م/60 وتاريخ 28/12/1425هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3e1de77d-3cd1-44d8-b174-a9a700f1ab06/1' eu,'عدلت هذه المادة بالمرسوم الملكى رقم (م / 60) وتاريخ 28 /12 / 1425 هـ ،لتصبح بالنص الآتى:

" المادة السادسة :

1 - يتكون مجلس إدارة الهيئة من عشرة من الأعضاء الأساسيين، تنتخبهم الجمعية العمومية، وتحدد اللائحة التنفيذية الإجراءات اللازمة لذلك وما يشترط في المرشحين، ويتولى مجلس الإدارة المنتخب اختيار رئيس المجلس ونائبه من بين أعضائه بالاقتراع السري.
2 - تكون مدة العضوية ثلاث سنوات قابلة للتجديد مرة واحدة.
3 - يعقد مجلس الإدارة جلسة على الأقل كل ثلاثة أشهر، كما يعقد عندما يطلب ذلك رئيس المجلس، أو أر' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '75491b4cf82867941eaf90aa185f96ac'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz644r4043hcwg2c1etw8fq') = '78e8a084e6ac864803d29e046e0619c1'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz644r4043hcwg2c1etw8fq' AND valid_from='2005-02-08'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-f1d8f640be5c5160d7eaeb84' id,'cmpz64gt6047jcwg2hmy8794l' unit_id,'مع مراعاة أحكام نظام الضمان الصحي التعاوني الصادر بالمرسوم الملكي رقم (م / 10) وتاريخ 1 / 5 / 1420هـ، يختص البنك المركزي السعودي بما يأتي:

تسلم طلبات تأسيس شركات التأمين وشركات إعادة التأمين التعاوني وشركات مزاولي الخدمات المساندة للتأمين ودراستها؛ للتأكد من استيفاء تلك الطلبات لضوابط الترخيص التي يضعها البنك المركزي السعودي، وإصدار الموافقة المبدئية تمهيداً لإحالتها إلى الجهة المختصة لاستكمال إجراءات التأسيس.

إصدار التراخيص والإشراف والرقابة وتنظيم أعمال شركات التأمين وشركات إعادة التأمين وأعمال مزاولي الخدمات المساندة للتأمين، ويمارس صلاحياته بموجب أحكام هذا النظام ولائحته التنفيذية، وله على الأخص ما يأتي:

أ- تنظيم وإجازة قواعد استثمار أموال عمليات التأمين وإعادة التأمين، ووضع معادلة توزيع فائض عمليات التأمين بين المساهمين والمؤمن لهم بعد مراعاة وجود حسابات منفصلة خاصة بالمساهمين وأخرى بالمؤمن لهم وعمليات التأمين.

ب- تحديد مقدار المبالغ المطلوب إيداعها لدى أحد البنوك المحلية لمزاولة كل نوع من أنواع التامين المختلفة.

ج- إقرار صيغ نماذج وثائق التأمين وإعادة التأمين ووضع الحد الأدنى لمبالغ تأمين تغطية المسؤوليات تجاه الغير مع مراعاة أحكام الأنظمة المعمول بها في ذلك.

د- وضع القواعد والضوابط التي تحدد كيفية استثمار أصول شركات التأمين وإعادة التأمين.

هـ- وضع القواعد العامة لتحديد الموجودات التي يجب على كل شركة أن تحتفظ بها داخل المملكة وخارجها وتحديد الحد الأدنى والحد الأعلى لكل فرع من فروع التأمين والشروط الواجب مراعاتها في كل فرع، وكذلك تحديد الحد الأدنى والحد الأعلى للاشتراكات والأقساط التأمينية مقابل راس مال الشركة والاحتياطات.

و- وضع القواعد والضوابط التي تكفل حقوق المستفيدين والتأكد من قدرة شركات التأمين على الوفاء بالمطالبات والالتزامات.

استحصال المقابل المالي على التراخيص والخدمات التي يقدمها، ويكون تحديد المقابل المالي بقرار من المحافظ.' body,'2021-08-31'::timestamptz valid_from,'مرسوم ملكي رقم م/12 وتاريخ 1443/1/23هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3e3c6fc3-9a45-4a0e-b28e-a9a700f1ad14/1' eu,'- عُدلت هذه المادة وذلك بموجب المرسوم الملكي رقم (م/12) وتاريخ 1443/1/23هـ، لتكون بالنص الآتي:

" مع مراعاة أحكام نظام الضمان الصحي التعاوني الصادر بالمرسوم الملكي رقم (م / 10) وتاريخ 1 / 5 / 1420هـ، يختص البنك المركزي السعودي بما يأتي:

تسلم طلبات تأسيس شركات التأمين وشركات إعادة التأمين التعاوني وشركات مزاولي الخدمات المساندة للتأمين ودراستها؛ للتأكد من استيفاء تلك الطلبات لضوابط الترخيص التي يضعها البنك المركزي السعودي، وإصدار الموافقة المبدئية تمهيداً لإحالتها إلى الجهة المختصة لاستكمال إجرا' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'eb3ee98b351bc7c1bf9874e41da7e1a2'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz64gt6047jcwg2hmy8794l') = '9ea3a600a6a57ef525e12f715dddad6a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz64gt6047jcwg2hmy8794l' AND valid_from='2021-08-31'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-c0b900a744b56667a2bce71f' id,'cmpzcv3hq09cvvtrkdry7cm30' unit_id,' يكون للهيئة مجلس إدارة يشكل من رئيس يعين بأمر ملكي، وعضوية كل من:
1- عدد لا يقل عن ثلاثة يمثلون جهات حكومية ذات علاقة بعمل الهيئة، لا تقل مرتبة أي منهم عن المرتبة الرابعة عشرة أو ما يعادلها، وتحدد تلك الجهات بقرار من مجلس الشؤون الاقتصادية والتنمية بناءً على اقتراح من المجلس  

2- خمسة من المهتمين والمتخصصين ومن ذوي الخبرة في المجالات ذات العلاقة بعمل الهيئة، يتم تعيينهم بقرار من مجلس الوزراء بناء على اقتراح من رئيس مجلس الشؤون الاقتصادية والتنمية. 

وتكون عضوية الأعضاء المشار إليهم في الفقرتين (1) و(2) لمدة (ثلاث) سنوات قابلة للتجديد لمرة واحدة.' body,'2020-04-28'::timestamptz valid_from,'قرار مجلس الوزراء رقم 577 وتاريخ 1441/9/5هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/497918e9-dba2-4282-a410-aa3f00a6d256/1' eu,'-عُدلت الفقرة (1) من هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (577) وتاريخ 1441/9/5هـ، لتكون بالنص الآتي: "عدد لا يقل عن ثلاثة يمثلون جهات حكومية ذات علاقة بعمل الهيئة، لا تقل مرتبة أي منهم عن المرتبة الرابعة عشرة أو ما يعادلها، وتحدد تلك الجهات بقرار من مجلس الشؤون الاقتصادية والتنمية بناءً على اقتراح من المجلس".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '5719eb47f402739b458d846d23af4e25'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv3hq09cvvtrkdry7cm30') = 'b20aa5694778030d82ab1242667c8085'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv3hq09cvvtrkdry7cm30' AND valid_from='2020-04-28'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-62ae68895dd22294b26daae6' id,'cmpzcv47909hlvtrktxqv6ati' unit_id,'المجلس هو السلطة المهيمنة على إدارة شؤون الهيئة والإشراف عليها وتصريف أمورها ، ويتخذ جميع القرارات اللازمة لتحقيق أهدافها في حدود أحكام هذا التنظيم ، وله على وجه خاص ما يأتي :

1 - إقرار السياسات والخطط التي تحقق أهداف الهيئة .

2 - إصدار اللوائح الإدارية والمالية ، بالاتفاق مع وزارة المالية ووزارة الخدمة المدنية.

3 - إصدار اللوائح اللازمة لتسيير عمل الهيئة .

4 - إقرار الهيكل التنظيمي للهيئة.

5 - الموافقة على إنشاء الفروع والمراكز والمكاتب .

6 - تعيين مراجع حسابات خارجي ومراقب مالي داخلي .

7 - الموافقة على مشروع الميزانية السنوية للهيئة وحسابها الختامي وتقرير مراجع الحسابات والتقرير السنوي تمهيداً لرفع ذلك وفقاً للإجراءات النظامية المتبعة .

8 - إقرار مصادر التمويل وقبول الهبات والإعانات والمنح والوصايا والأوقاف، بما لا يتعارض مع القواعد التي تنظم تلقي الجهات الحكومية تبرعات عينية أو نقدية .

9 - تشكيل لجان دائمة أو مؤقتة من بين أعضائها أو من غيرهم ، وتحديد مهماتهم واختصاصاتهم ومزاياهم المالية.

10 - إقرار القواعد والتنظيمات الخاصة بتنمية موارد الهيئة واستثماراتها .

11 - تقدير الإعانات ومستوى ونوع خدمات الإغاثة التي تقدمها الهيئة داخل المملكة وخارجها .

12 - إقرار التوجهات والسياسات الخاصة بعلاقة الهيئة بمنظمات الحركة الدولية للهلال الأحمر والصليب الأحمر وغيرها من المنظمات ذات العلاقة بأعمالها .

13 - إقرار قواعد منح الشارات والأوسمة والشهادات الفخرية والعضوية .

14 - إقرار القواعد التي تنظم التطوع في أعمال الهيئة ، وفقاً للخطة العامة المنظمة لذلك .

15 - إقرار الخطط والقواعد التي تنظم عمل الهيئة في حالات الطوارئ وفقاً للخطة المعتمدة المنظمة لذلك .

وللمجلس بقرار منه تفويض بعض الصلاحيات إلى رئيسه أو من يراه من أعضائه أو من مسؤولي الهيئة.' body,'2017-01-09'::timestamptz valid_from,'قرار مجلس الوزراء رقم 217 وتاريخ 11/4/1438هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/49ab78f2-a4ad-42f8-97ce-a9a700f28035/1' eu,'تم تعديل هذه المادة بموجب قرار مجلس الوزراء رقم (217) وتاريخ 11/ 4/ 1438هـ ، وذلك :

بإحلال عبارة  "وللمجلس بقرار منه تفويض بعض الصلاحيات إلى رئيسه أو من يراه من أعضائه أو من مسؤولي الهيئة"

محل عبارة  "وللمجلس بقرار منه تفويض بعض الصلاحيات إلى الرئيس أو غيره من مسؤولي الهيئة"، الواردة في نهاية المادة .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '20eb8ae7f35023c28b0df7b0dd885008'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv47909hlvtrktxqv6ati') = 'fa28eae848d8be942fc5cafde22dd825'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv47909hlvtrktxqv6ati' AND valid_from='2017-01-09'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-7d79e1aeb3cc7b04fc022276' id,'cmpzcv47909hlvtrktxqv6ati' unit_id,'المجلس هو السلطة المهيمنة على إدارة شؤون الهيئة والإشراف عليها وتصريف أمورها ، ويتخذ جميع القرارات اللازمة لتحقيق أهدافها في حدود أحكام هذا التنظيم ، وله على وجه خاص ما يأتي :

1 - إقرار السياسات والخطط التي تحقق أهداف الهيئة .
2 - إقرار اللوائح المالية والإدارية التي تسير عليها الهيئة، على أن يكون إقرار اللوائح الإدارية بالاتفاق مع وزارة الموارد البشرية والتنمية الاجتماعية، وأن يكون إقرار اللوائح المالية والأحكام ذات الأثر المالي في اللوائح الإدارية بالاتفاق مع وزارة المالية

3 - إصدار اللوائح اللازمة لتسيير عمل الهيئة .

4 - إقرار الهيكل التنظيمي للهيئة.

5 - الموافقة على إنشاء الفروع والمراكز والمكاتب .

6 - تعيين مراجع حسابات خارجي ومراقب مالي داخلي .

7 - الموافقة على مشروع الميزانية السنوية للهيئة وحسابها الختامي وتقرير مراجع الحسابات والتقرير السنوي تمهيداً لرفع ذلك وفقاً للإجراءات النظامية المتبعة .

8 - إقرار مصادر التمويل وقبول الهبات والإعانات والمنح والوصايا والأوقاف، بما لا يتعارض مع القواعد التي تنظم تلقي الجهات الحكومية تبرعات عينية أو نقدية .

9 - تشكيل لجان دائمة أو مؤقتة من بين أعضائها أو من غيرهم ، وتحديد مهماتهم واختصاصاتهم ومزاياهم المالية.

10 - إقرار القواعد والتنظيمات الخاصة بتنمية موارد الهيئة واستثماراتها .

11 - تقدير الإعانات ومستوى ونوع خدمات الإغاثة التي تقدمها الهيئة داخل المملكة وخارجها .

12 - إقرار التوجهات والسياسات الخاصة بعلاقة الهيئة بمنظمات الحركة الدولية للهلال الأحمر والصليب الأحمر وغيرها من المنظمات ذات العلاقة بأعمالها .

13 - إقرار قواعد منح الشارات والأوسمة والشهادات الفخرية والعضوية .

14 - إقرار القواعد التي تنظم التطوع في أعمال الهيئة ، وفقاً للخطة العامة المنظمة لذلك .

15 - إقرار الخطط والقواعد التي تنظم عمل الهيئة في حالات الطوارئ وفقاً للخطة المعتمدة المنظمة لذلك .

وللمجلس بقرار منه تفويض بعض الصلاحيات إلى رئيسه أو من يراه من أعضائه أو من مسؤولي الهيئة.' body,'2021-07-13'::timestamptz valid_from,'قرار مجلس الوزراء رقم 722 وتاريخ 1442/12/3هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/49ab78f2-a4ad-42f8-97ce-a9a700f28035/1' eu,'- عُدلت الفقرة (2) من هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (722) وتاريخ 1442/12/3هـ، لتصبح بالنص الآتي: "إقرار اللوائح المالية والإدارية التي تسير عليها الهيئة، على أن يكون إقرار اللوائح الإدارية بالاتفاق مع وزارة الموارد البشرية والتنمية الاجتماعية، وأن يكون إقرار اللوائح المالية والأحكام ذات الأثر المالي في اللوائح الإدارية بالاتفاق مع وزارة المالية".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'bef2eaa3760f8a79e274f87f23c6b352'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv47909hlvtrktxqv6ati') = 'fa28eae848d8be942fc5cafde22dd825'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv47909hlvtrktxqv6ati' AND valid_from='2021-07-13'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-ef76f8e273ad00ce9c55e136' id,'cmpzcv47909hmvtrkt6say0e4' unit_id,'1 -  	 يعقد المجلس اجتماعاته في مقر الهيئة الرئيس ، ويجوز عند الحاجة انعقاد المجلس في أي مكان آخر في المملكة بناء على طلب رئيسه.

2   -	  يجتمع المجلس بصفة دورية مرة كل ثلاثة أشهر على الأقل ، ولرئيس المجلس دعوته للاجتماع متى دعت الحاجة إلى ذلك ، أو متى طلب نصف أعضاء المجلس على الأقل عقد اجتماع ، ويجب أن تشتمل الدعوة على جدول الأعمال .

3  -  	 ينعقد الاجتماع بحضور أغلبية الأعضاء بمن فيهم رئيس المجلس ، أو نائبه، وللمجلس أن يدعو لحضور جلساته من يرى الاستعانة بخبراتهم ومعلوماتهم دون أن يكون لهم حق التصويت.' body,'2017-01-09'::timestamptz valid_from,'قرار مجلس الوزراء رقم 217 وتاريخ 11/4/1438هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/49ab78f2-a4ad-42f8-97ce-a9a700f28035/1' eu,'تم تعديل الفقرة (3) من هذه المادة بموجب قرار مجلس الوزراء رقم (217) وتاريخ 11/ 4/ 1438هـ ، وذلك:

بإحلال عبارة "أو نائبه"

محل عبارة "أو من ينيبه" الواردة في الفقرة (3) من هذه المادة .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd3c751fa3634cde2e63e4656e8cc17c4'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv47909hmvtrkt6say0e4') = '198fe2de89fdfb6cd86daa9b2bc9fd55'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv47909hmvtrkt6say0e4' AND valid_from='2017-01-09'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-1c07783de2765ed2302e0cbc' id,'cmpz9eq4i0cgnybvvzbkdfxmt' unit_id,'مجلس الإدارة هو السلطة العليا في إدارة شؤون المؤسسة وتصريف أمورها، ويشمل ذلك على سبيل المثال لا الحصر ما يأتي:

1 - الإشراف العام على حسن تنفيذ نظام التقاعد ولوائحه التنفيذية، والمراجعة الدورية لأداء المؤسسة، واتخاذ كل ما يراه لبلوغ أهدافها وسير أعمالها.

2 - اعتماد استراتيجية المؤسسة بما يكفل تحقيق أهدافها على الوجه الأكمل وبلوغ أعلى مستويات الفعالية والكفاية في أدائها.

3 - إصدار اللوائح التنفيذية لهذا التنظيم وتعديلها.
4 - إصدار التنظيم الإداري والدليل التنظيمي للمؤسسة.
5 - اعتماد الميزانية السنوية للمؤسسة.
6 - إقرار  الحساب الختامي    والتقرير السنوي للمؤسسة تمهيدا لرفعهما إلى   رئيس مجلس الوزراء ، لاستكمال الإجراءات النظامية.
7 - إقرار سياسات استثمار أموال المؤسسة وقواعده وخططه، واعتماد جميع مشاريع الاستثمار.
8 - اعتماد سلم رواتب موظفي المؤسسة وبدلاتهم ومكافآتهم ومزاياهم، بعد التنسيق مع وزارة المالية ووزارة الخدمة المدنية.
9 - إصدار اللوائح المالية والوظيفية والمحاسبية الخاصة بالمؤسسة، بعد التنسيق مع وزارة المالية، ووزارة الخدمة المدنية.
10 - الموافقة على إنشاء فروع ومكاتب للمؤسسة.
11 - تشكيل لجنة مراجعة، تحدد مهماتها وعدد أعضائها ومكافآتهم ومدة عضويتهم لائحة يصدرها مجلس الإدارة، على أن يكون من مهماتها تقويم اللوائح والقواعد والضوابط الرقابية والتأكد من فعاليتها.
12 - تعيين مراجع حسابات خارجي، ومراقب مالي داخلي.
13 - إجراء مراجعة دورية لهذا التنظيم ولنظام التقاعد واقتراح ما يلزم في شأنهما، ورفع ذلك بحسب النظام.
14 - النظر في المواضيع التي يحيلها إليه رئيس مجلس الإدارة.
15 - القيام بأي مهمة أخرى تعهد إليه بموجب نظام التقاعد أو لوائحه، أو بموجب أنظمة أخرى.
16 - تفويض بعض الصلاحيات للمحافظ أو غيره.
17 - تشكيل لجان دائمة أو مؤقتة من مجلس الإدارة أو من خارجه للقيام بالمهمات التي يكلفها بها المجلس' body,'2015-08-17'::timestamptz valid_from,'قرار مجلس الوزراء رقم 461 وتاريخ 2/11/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5160cfca-da74-4008-97e2-a9a700f23b92/1' eu,'تم تعديل الفقرة (17)  من هذه المادة بموجب قرار مجلس الوزراء رقم (461) وتاريخ 2/ 11/ 1436هـ ، لتصبح بالنص الآتي :

"17 - تشكيل لجان دائمة أو مؤقتة من مجلس الإدارة أو من خارجه للقيام بالمهمات التي يكلفها بها المجلس".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'a5f4fc1bec1bb61f23ff77dbe0cc2aa0'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz9eq4i0cgnybvvzbkdfxmt') = '032cfc4cd8c2703e3e52f7d5338b9f02'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz9eq4i0cgnybvvzbkdfxmt' AND valid_from='2015-08-17'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-ba0ad77c6a9af665cb58d595' id,'cmpz9eqfj0cgrybvvvnozgoqn' unit_id,'يعين المحافظ بالمرتبة الممتازة بناء على ترشيح رئيس المجلس، وهو الرئيس التنفيذي للمؤسسة ويتولى إدارة شؤونها، ويكون مسؤولا أمام مجلس الإدارة عن الأعمال والمهمات التي ينفذها. وله على وجه الخصوص الصلاحيات والمهمات التالية :' body,'2015-08-17'::timestamptz valid_from,'قرار مجلس الوزراء رقم 461 وتاريخ 2/11/1436هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5160cfca-da74-4008-97e2-a9a700f23b92/1' eu,'تم بموجب قرار مجلس الوزراء رقم (461) وتاريخ 2/ 11/ 1436هـ ،  إضافة عبارة ( بناء على ترشيح رئيس المجلس)

بعد عبارة  ( يعين المحافظ بالمرتبة الممتازة ) الواردة في صدر هذه المادة ، ليصبح صدر المادة بالنص الآتي:

"يعين المحافظ بالمرتبة الممتازة بناء على ترشيح رئيس المجلس، ويكون هو الرئيس التنفيذي للمؤسسة ...".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'ccfc66f164523a74124b66d1a1136ae2'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz9eqfj0cgrybvvvnozgoqn') = '97cb8ae757a4906e0d6a01e4f63b6d0c'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz9eqfj0cgrybvvvnozgoqn' AND valid_from='2015-08-17'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-d869dfa7485eb1d399948fd0' id,'cmpz6e7oj07h7cwg2rlxlksj4' unit_id,'يكون تشكيل مجلس إدارة المركز بأمر من رئيس مجلس الوزراء بناء على ترشيح يتفق عليه بين وزارة التجارة والاستثمار، ووزارة العدل، بالتنسيق مع اتحاد الغرف التجارية السعودية، وتكون مدة العضوية فيه (ثلاث) سنوات قابلة للتجديد مرة واحدة، ويكون رئيس المجلس ونائبه وأعضاؤه ممن سبق لهم العمل في القطاع الخاص ذي الصلة لمدة لا تقل عن (عشر) سنوات للرئيس و(خمس) سنوات للأعضاء، ولا يكون أي منهم شاغلاً لمنصب أو وظيفة حكومية.' body,'2023-08-08'::timestamptz valid_from,'قرار مجلس الوزراء رقم 68 وتاريخ 1445/1/21هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/54ff827d-8488-49aa-b593-aa4400c961fd/1' eu,'- إحلال عبارة "اتحاد الغرف التجارية السعودية" محل عبارة "اللجنة الدائمة"، وذلك بموجب قرار مجلس الوزراء رقم (68) وتاريخ 1445/1/21هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'ce832f74d8aaca62de75b1a656d1a032'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6e7oj07h7cwg2rlxlksj4') = '5f32160bdc5a64573927a23019ea9d9e'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6e7oj07h7cwg2rlxlksj4' AND valid_from='2023-08-08'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-e4aba3da99f4eed840dd70a6' id,'cmpzcuvwu07bgvtrkop1s0hap' unit_id,'1- لا يصح الاتفاق على التحكيم إلا ممن يكون أهلاً للتصرف سواء أكان شخصاً ذا صفة طبيعية أم شخصاً ذا صفة اعتبارية
2  - لا يجوز للجهات الحكومية الاتفاق على التحكيم إلا بعد موافقة رئيس مجلس الوزراء، ما لم يرد نص نظامي خاص يجيز ذلك.' body,'2025-07-21'::timestamptz valid_from,'مرسوم ملكي رقم م/21 وتاريخ 1447/1/26هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5535039e-13da-43f6-8f53-a9a700f26485/1' eu,'- عُدلت الفقرة (1) من هذه المادة وذلك بموجب  المرسوم الملكي رقم (م/21) وتاريخ 1447/1/26هـ، لتكون بالنص الآتي:

"1- لا يصح الاتفاق على التحكيم إلا ممن يكون أهلاً للتصرف سواء أكان شخصاً ذا صفة طبيعية أم شخصاً ذا صفة اعتبارية".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'c73d5590ad325be195f3f1ff352942aa'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcuvwu07bgvtrkop1s0hap') = '5eaf6b6de8891795756da8dc8898cbd3'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcuvwu07bgvtrkop1s0hap' AND valid_from='2025-07-21'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b36f442deb45cf0cdf0df841' id,'cmpzcvahb0bc1vtrkouvz40i2' unit_id,'يصرف بدل تفرغ لمن يستحق من موظفي الديوان الفنيين بأمر ملكي بناء على اقتراح رئيس الديوان.' body,'2020-07-23'::timestamptz valid_from,'مرسوم ملكي رقم م/178 وتاريخ 2/12/1441هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5dc538d4-5bbd-4995-8f0c-a9a700f2c88c/1' eu,'- إحلال عبارة "بأمر ملكي" محل عبارة "بقرار من مجلس الوزراء". وذلك بموجب المرسوم الملكي رقم (م / 178) وتاريخ 2 / 12 / 1441هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '35d948a5d18f404be9c8be6831646daf'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvahb0bc1vtrkouvz40i2') = 'a9d9bf172a0eac747d105180fb963c3c'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvahb0bc1vtrkouvz40i2' AND valid_from='2020-07-23'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-f56f54750f83666089aadeca' id,'cmpz6797m054rcwg2dgyem9in' unit_id,'يلتزم مستوردو المواد الكيميائية والقائمون على إداراتها بما يأتي:

1 -  إنهاء إجراءات إذن الفسح قبل وصول المواد الكيميائية إلى المملكة أو حال وصولها.
2 -  تسلم المواد الكيميائية المستوردة ونقلها خلال مدة لا تتجاوز ثلاثة أيام عمل من تاريخ فسحها من المنافذ الجمركية .
3 - نقل المواد الكيميائية بطريقة آمنة وبوساطة وسائل نقل مرخص لها.
4 -  إبلاغ وزارة الداخلية قبل نقل المواد الكيميائية الخطرة.
5 -  تخزين المواد الكيميائية في أماكن مخصصة لها، وفق الشروط والتعليمات التي تحددها اللائحة.
6 - تطبيق التعليمات الخاصة بسلامة العاملين في المنشآت التي تتعامل مع المواد الكيميائية .
7 - تطبيق المواصفات القياسية الخاصة بعبوات المواد الكيميائية .
8 - عدم استخدام المواد الكيميائية المستوردة في غير المجال الذي طلبت من أجله إلا بعد موافقة الجهة المختصة.
9 - عدم تداول المواد الكيميائية إلا في الأماكن المخصصة لذلك.
10 - التعامل مع المواد الكيميائية بواسطة أشخاص مؤهلين في مجال السلامة والوقاية.
11 - إبلاغ الجهة المختصة والرئاسة العامة للأرصاد وحماية البيئة بصفة دورية بما لديهم من مواد كيميائية متراكمة أو منتهية الصلاحية أو نفايات كيميائية .
12 - التخلص من النفايات الكيميائية بواسطة مرفق متخصص مرخص له من المركز الوطني لإدارة النفايات، على أن تبلّغ وزارة البيئة والمياه والزراعة (المركز البيئي المختص) قبل التخلص من هذه النفايات وفقاً لما تحدده اللائحة' body,'2023-01-31'::timestamptz valid_from,'قرار مجلس الوزراء رقم 476 وتاريخ 1444/7/9هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/64aee787-4618-4979-b4d8-a9a700f1c647/1' eu,'- تعديل الفقرة (12) من هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (476) وتاريخ 1444/7/9هـ، لتصبح بالنص الآتي: "التخلص من النفايات الكيميائية بواسطة مرفق متخصص مرخص له من المركز الوطني لإدارة النفايات، على أن تبلّغ وزارة البيئة والمياه والزراعة (المركز البيئي المختص) قبل التخلص من هذه النفايات وفقاً لما تحدده اللائحة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '957bcddeb794415840ef2388c3c389cc'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6797m054rcwg2dgyem9in') = '29ad6010b5aa15dfb165c788c54d84e9'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6797m054rcwg2dgyem9in' AND valid_from='2023-01-31'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-fc03e3c4ce7f437a13cac36a' id,'cmpz6mvo00akjcwg2z9lzwy9m' unit_id,'أ‌ - يلزم مرتكب المخالفة بالتعويض عن جميع الأضرار التي لحقت بالمرفق أو الغير، بما في ذلك تكاليف إصلاح التلف الذي تسبب في حدوثه و التعويض عن المنفعة التي فقدها المرفق أو الغير ويحتسب التعويض للمتر المكعب عن المياه الضائعة بسبب المخالفة وفق قواعد تضعها لجنة تشكل من وزارة المالية ، ووزارة الشؤون البلدية والقروية ووزارة المياه والكهرباء وللجهة المختصة أن تلزم مرتكب المخالفة بإصلاح ما ينتج من مخالفته أو أن تقوم بالإصلاح على نفقة المخالف ويرجع عليه في مياه الحالة بجميع المصاريف  والنفقات اللازمة لإزالة التعدي وإصلاح الأضرار التي ترتبت عليها فإن لم يدفعها فإنها تستوفي من مستحقاته لدى جهة حكومية أوتحصل وفقا لقواعد جباية أموال الدولة' body,'2007-06-20'::timestamptz valid_from,'مرسوم ملكي رقم م/54 وتاريخ 5/6/1428هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/70405759-cf34-4260-a81e-a9a700f21241/1' eu,'تم تعديل الفقرة (أ) من هذه المادة بموجب المرسوم الملكي رقم (م/54) وتاريخ 5 / 6 / 1428 هـ ، لتكون بالنص الآتي:

" أ‌ - يلزم مرتكب المخالفة بالتعويض عن جميع الأضرار التي لحقت بالمرفق أو الغير، بما في ذلك تكاليف إصلاح التلف الذي تسبب في حدوثه و التعويض عن المنفعة التي فقدها المرفق أو الغير ويحتسب التعويض للمتر المكعب عن المياه الضائعة بسبب المخالفة وفق قواعد تضعها لجنة تشكل من وزارة المالية ، ووزارة الشؤون البلدية والقروية ووزارة المياه والكهرباء وللجهة المختصة أن تلزم مرتكب المخالفة بإصلاح ما ينتج' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '51d41879c10ce957159a883810acfc2f'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6mvo00akjcwg2z9lzwy9m') = '470ee48cec0c310470b8ce5cdc0b3c5c'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6mvo00akjcwg2z9lzwy9m' AND valid_from='2007-06-20'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0a7435d352cad485803071d3' id,'cmpz6mvze0akncwg2a94trlwi' unit_id,'أ- يختص  ديوان المظالم    بتوقيع عقوبة السجن المنصوص عليها في هذا النظام.
ب - تقدر التعويضات ويحدد مقدار الغرامة عن كل مخالفة ضمن حدها المنصوص عليه في هذا النظام وفق قواعد يصدرها الوزير المختص ويصدر قرار التعويض أو التعويض أو الغرامة الوزير المختص أو من يفوضه ويجوز التظلم منه أمام ديوان المظالم خلال (ستين ) يوما من تاريخ إبلاغ المخالف به' body,'2007-06-20'::timestamptz valid_from,'مرسوم ملكي رقم م/54 وتاريخ 5/6/1428هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/70405759-cf34-4260-a81e-a9a700f21241/1' eu,'تم  تعديل الفقرة (ب) من هذه المادة بموجب المرسوم الملكي رقم (م/54) وتاريخ 5 / 6 / 1428 هـ ، لتكون بالنص الآتي:

" ب - تقدر التعويضات ويحدد مقدار الغرامة عن كل مخالفة ضمن حدها المنصوص عليه في هذا النظام وفق قواعد يصدرها الوزير المختص ويصدر قرار التعويض أو التعويض أو الغرامة الوزير المختص أو من يفوضه ويجوز التظلم منه أمام ديوان المظالم خلال (ستين ) يوما من تاريخ إبلاغ المخالف به."' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '97f02b661d9fb115519df5f86832e049'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6mvze0akncwg2a94trlwi') = '5777182c263fe1aa585b7c1284cc3197'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6mvze0akncwg2a94trlwi' AND valid_from='2007-06-20'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-4a1cbdf52910dec77e60e472' id,'cmpz5wf8901jncwg2180tzvhf' unit_id,'كل شخص    طلب لنفسه أو لغيره أو قبل أو أخذ وعدا أو عطية لاستعمال نفوذ حقيقي أو مزعوم للحصول أو لمحاولة الحصول من أية سلطة عامة على عمل أو أمر أو قرار أو التزام أو ترخيص أو اتفاق توريد أو على وظيفة أو خدمة أو مزية من أي نوع، يعد مرتشيا ويعاقب بالعقوبة المنصوص عليها في المادة الأولى من هذا النظام.' body,'2021-12-02'::timestamptz valid_from,'مرسوم ملكي رقم م/38 وتاريخ 1443/4/27هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/75e963c8-9ff3-4d10-88a4-a9a700f17f21/1' eu,'- إحلال عبارة "كل شخص" محل عبارة "كل موظف عام" ، وذلك بموجب المرسوم الملكي رقم (م/38) وتاريخ 1443/4/27هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '128849dd183422075ef20071b4e02e69'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5wf8901jncwg2180tzvhf') = 'dfd53131105c98c5753cafccfad0e34b'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5wf8901jncwg2180tzvhf' AND valid_from='2021-12-02'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-dfb9c71db00cbfc26f72253c' id,'cmpz5whbr01kbcwg22f4w2ndg' unit_id,'كل من أرشد إلى جريمة من الجرائم المنصوص عليها في النظام وأدت معلوماته إلى ثبوت الجريمة ولم يكن راشيا أو شريكا أو وسيطا يمنح مكافأة لا تقل عن خمسة آلاف ريال ولا تزيد عن نصف قيمة المال المصادر، وتقدر المكافأة الجهة التي تحكم في الجريمة، ويجوز لرئاسة أمن الدولة صرف مكافأة أعلى من المبلغ الذي يحدد بمقتضى هذه المادة، وذلك بعد موافقة رئيس مجلس الوزراء عليها.' body,'2019-07-10'::timestamptz valid_from,'مرسوم ملكي رقم م/127 وتاريخ 1440/11/7هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/75e963c8-9ff3-4d10-88a4-a9a700f17f21/1' eu,'- إحلال عبارة "لرئاسة أمن الدولة" محل عبارة "لوزارة الداخلية" الواردة في المادة (السابعة عشرة) من هذا النظام وذلك بموجب المرسوم الملكي رقم (م/127) وتاريخ 1440/11/7هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '57a7d833cdfaa85d5ba105947e51479b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5whbr01kbcwg22f4w2ndg') = '53aa0a6780b28913107d67e664cc9740'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5whbr01kbcwg22f4w2ndg' AND valid_from='2019-07-10'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-3aa2ef4a8d1992df8b9df022' id,'cmpz5whyy01kjcwg2qfcfphat' unit_id,'على  رئاسة أمن الدولة  نشر الأحكام التي تصدر في   جرائم الرشوة    وإعلانها.' body,'2019-07-10'::timestamptz valid_from,'مرسوم ملكي رقم م/127 وتاريخ 1440/11/7هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/75e963c8-9ff3-4d10-88a4-a9a700f17f21/1' eu,'- إحلال عبارة "رئاسة أمن الدولة" محل عبارة "وزارة الداخلية" الواردة في هذه المادة وذلك بموجب المرسوم الملكي رقم (م/127) وتاريخ 1440/11/7هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '9df8a6b079c413d05dd3e60fa00decc2'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5whyy01kjcwg2qfcfphat') = '40f50c0170ffd51e37dd4638a63e0271'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5whyy01kjcwg2qfcfphat' AND valid_from='2019-07-10'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-fe6672429b2a7d0a49ae0251' id,'cmpz5xts1020xcwg220iazjdx' unit_id,'( لوزير الداخلية بعد إجراء التحقيق اللازم حق حفظ الدعوى كما أن له ايقاف تنفيذ الجزاءات أو جزء منها إذا رأى ذلك من مقتضيات المصلحة العامة ) .' body,'1993-12-29'::timestamptz valid_from,'مرسوم ملكي رقم م/9 وتاريخ 16/7/1414هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/871b7db0-6d40-4380-90a1-a9a700f188c7/1' eu,'تم إضافة مادة الى هذا النظام وذلك بموجب المرسوم الملكي   رقم (م /9) وتاريخ 16 / 7 / 1414 هـ ، لتصبح المادة رقم (7) من هذا النظام ونصها مايلى :

( لوزير الداخلية بعد إجراء التحقيق اللازم حق حفظ الدعوى كما أن له ايقاف تنفيذ الجزاءات أو جزء منها إذا رأى ذلك من مقتضيات المصلحة العامة ) .' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2a6bd8088faea3c4df88862d6d1504cc'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5xts1020xcwg220iazjdx') = '6ea756277970f7bba9e2821444fd2303'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5xts1020xcwg220iazjdx' AND valid_from='1993-12-29'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-85e9969d8c04adf1effab350' id,'cmpzcv7lk0ajpvtrktfswgju6' unit_id,'أ  - إذا لم يشترِك صاحِب العمل أو لم يقُم بدفع أقساط الضمان الصحي التعاوني عن العامِل لديه مِّمن ينطبق عليه هذا النِظام وأفراد أُسرتِه المشمولين معه بوثيقة الضمان الصحي التعاوني، أُلزِم بدفع جميع الأقساط الواجِبة السداد، إضافة إلى دفع غرامة مالية    لا تزيد على قيمة الاشتِراك السنوي عن كُل فرد. مع جواز حِرمانِه مِن استِقدام العُمال لفترة دائمة أو مؤقتة.
وتُحدِّد اللائحة التنفيذية    الجهة التي تدفع إليها الأقساط الواجِبة السداد في هذه الحالة.
ب  -  إذا أخلت أي مِن  شركات التأمين التعاوني    بأي مِن التِزاماتِها المُحدَّدة في  وثيقة الضمان الصحي التعاوني ، أُلزِمت بالوفاء بهذه الالتِزامات وبالتعويض عمَّا نشاء عن الإخلال بِها مِن أضرار، إضافة إلى دفع غرامة لا تزيد على خمسة ألاف ريال عن كُل فرد مشمول بالوثيقة محل المُخالفة.
ج - تُشكل بقرار مِن  رئيس مجلِس الضمان الصحي    لجنة أو أكثر، يشترِك فيها مُّمثِل مِن :

1  -  وزارة الداخلية .
2  -  وزارة العمل .
3 -  وزارة العدل .
4 -  وزارة المالية والاقتِصاد الوطني .
5  -  وزارة الصحة .
6  -  وزارة التجارة .

وتختص هذه اللجنة بالنظر في مُخالفات أحكام هذا النِظام واقتِراح الجزاء المُناسِب، ويوقع الجزاء بقرار مِن رئيس مجلِس الضمان الصحي، وتُحدِّد اللائحة التنفيذية    كيفية عمل هذه اللجنة.
ويجوز التظلُّم مِن هذا القرار أمام  ديوان المظالم    خِلال ستين يوماً مِن إبلاغِه.' body,'2004-10-18'::timestamptz valid_from,'قرار مجلس الوزراء رقم 246 وتاريخ 4/9/1425هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/87c1482d-fa95-41ea-98b6-a9a700f2a529/1' eu,'حل اسم (وزارة العمل) محل (وزارة العمل والشؤون الاجتِماعية) وذلك بموجب قرار مجلس الوزراء رقم (246) وتاريخ 4 / 9 / 1425 هـ، لتصبح المادة كما يلى :

أ  - إذا لم يشترِك صاحِب العمل أو لم يقُم بدفع أقساط الضمان الصحي التعاوني عن العامِل لديه مِّمن ينطبق عليه هذا النِظام وأفراد أُسرتِه المشمولين معه بوثيقة الضمان الصحي التعاوني، أُلزِم بدفع جميع الأقساط الواجِبة السداد، إضافة إلى دفع غرامة مالية    لا تزيد على قيمة الاشتِراك السنوي عن كُل فرد. مع جواز حِرمانِه مِن استِقدام العُمال لفترة دائمة أو مؤقتة' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'd2cfb58d4a4811320c4083574a4e556b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv7lk0ajpvtrktfswgju6') = 'cebf71aaa932500c4ded380cc365e1ee'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv7lk0ajpvtrktfswgju6' AND valid_from='2004-10-18'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-e5bef0874e3e017f9add8f11' id,'cmpz7zs2z0c6p7b6w3hfvzvb8' unit_id,'إجازة المرافقة الدراسية: يجوز بقرار من الوزير منح الضابط الذي يرغب في مرافقة زوجته المبتعثة للدراسة في الخارج أو أحد ممن يعولهم شرعاً إجازة مرافقة دراسية، وذلك بقدر مدة المرافقة، على أن تكون دون راتب وألا تحتسب المدة لأغراض التقاعد والترقية.' body,'2020-11-12'::timestamptz valid_from,'مرسوم ملكي رقم م/28 وتاريخ 1442/3/26هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8a12c94e-5a31-45cf-9c57-ac4400be8677/1' eu,'- إضافة مادة برقم (97 مكرر ) وذلك بموجب المرسوم الملكي رقم (م/28) وتاريخ 1442/3/26هـ، لتكون بالنص الآتي: "إجازة المرافقة الدراسية: يجوز بقرار من الوزير منح الضابط الذي يرغب في مرافقة زوجته المبتعثة للدراسة في الخارج أو أحد ممن يعولهم شرعاً إجازة مرافقة دراسية، وذلك بقدر مدة المرافقة، على أن تكون دون راتب وألا تحتسب المدة لأغراض التقاعد والترقية".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'cf195c3549fe04f4e3b014787b663eab'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz7zs2z0c6p7b6w3hfvzvb8') = 'b947f32698a055edba71d49b35965e51'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz7zs2z0c6p7b6w3hfvzvb8' AND valid_from='2020-11-12'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-99074e3b50f1d60021a038e5' id,'cmpzcvf6q0cnuvtrknu7h7nqz' unit_id,'يجوز لأي شخص تقديم أي من الخدمات البريدية بناءً على ترخيص، أو تسجيل، أو إعفاء من الهيئة؛ وفقاً للإجراءات والمتطلبات التي تحددها اللائحة. . ' body,'2022-07-26'::timestamptz valid_from,'قرار مجلس الوزراء رقم 705 وتاريخ 1443/12/27هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8ca91427-5be7-4807-80ae-adc700a97f0d/1' eu,'- حذف عبارة "وبالنسبة للطرود فيشترط قبل ذلك الحصول على الترخيص اللازم من الهيئة العامة للنقل" من عجز هذه المادة، وذلك بموجب قرار مجلس الوزراء رقم (705) وتاريخ 1443/12/27هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '86eeead17c7fcedae441fb8185319891'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvf6q0cnuvtrknu7h7nqz') = '05294373ef596dc3f9579805100ba8be'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvf6q0cnuvtrknu7h7nqz' AND valid_from='2022-07-26'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-fc6f5e9f304f5f60d2a11cb5' id,'cmpz6kfvc09pxcwg2j8r3gaht' unit_id,'ينشأ مجلس يسمى "مجلس شؤون الجامعات" ويتكون من الآتي:

وزير التعليم                                                                            رئيساً

نائب وزير التعليم                                     عضواً

نائب وزير المالية                                                                     عضواً

نائب وزير الخدمة المدنية                                                            عضواً

نائب وزير العمل والتنمية الاجتماعية                                               عضواً   

نائب وزير الاقتصاد والتخطيط                                                      عضواً

رئيس هيئة تقويم التعليم والتدريب                                                   عضواً   

خمسة من رؤساء الجامعات أحدهم من رؤساء الجامعات الأهلية                 أعضاء

اثنان من ذوي الخبرة والاختصاص                                               عضوين

ويرشح وزير التعليم الأعضاء الوارد ذكرهم في الفقرتين (8، 9)، ويصدر تعيينهم بأمر من رئيس مجلس الوزراء لمدة ثلاث سنوات قابلة للتجديد لمرة واحدة.' body,'2026-01-13'::timestamptz valid_from,'قرار مجلس الوزراء رقم 514 وتاريخ 1447/7/24هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8ee74282-7f0d-49ff-b6ee-aafc00a3d801/1' eu,'- تعديل الفقرة (2) من هذه المادة  وذلك  بموجب قرار مجلس الوزراء رقم (514) وتاريخ 1447/7/24هـ، وذلك بإحلال عبارة "نائب وزير التعليم" محل عبارة "نائب وزير التعليم للجامعات والبحث والابتكار". ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'afb7dddbb3f43c263840d848b10d756b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6kfvc09pxcwg2j8r3gaht') = '30424017952eb3bafafcc5b4cba5dc5a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6kfvc09pxcwg2j8r3gaht' AND valid_from='2026-01-13'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-36e4138c72be86429aae2272' id,'cmpz6lmv80a4zcwg2w34bscf5' unit_id,'مع عدم الإخلال بما للجهات الحكومية الأخرى من اختصاصات وفقاً للأنظمة، تخضع شركات ضيافة الحجاج وشركات تقديم الخدمة لإشراف الوزارة فيما يتعلق باختصاصها، وفقاً للأنظمة والتعليمات المنظمة لذلك. ' body,'2025-11-03'::timestamptz valid_from,'مرسوم ملكي رقم م/89 وتاريخ 1447/5/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/962235c2-9fa8-4c1a-b835-aa6400dd851e/1' eu,'- إحلال عبارة "شركات ضيافة الحجاج" محل عبارة "شركات أرباب الطوائف" أينما وردت في المادة وذلك بموجب  المرسوم الملكي رقم (م/89) وتاريخ 1447/5/12هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f101a0e534c378ccee38a99663772704'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6lmv80a4zcwg2w34bscf5') = '6dd92cf60c03880497272ee09d61e259'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6lmv80a4zcwg2w34bscf5' AND valid_from='2025-11-03'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-ce3451403b0d7d67f22416f6' id,'cmpz6lncb0a55cwg2gjl25kf5' unit_id,'تخضع شركات ضيافة الحجاج وشركات تقديم الخدمة -فيما لم يرد فيه نص خاص في النظام- لأحكام نظام الشركات.' body,'2025-11-03'::timestamptz valid_from,'مرسوم ملكي رقم م/89 وتاريخ 1447/5/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/962235c2-9fa8-4c1a-b835-aa6400dd851e/1' eu,'- إحلال عبارة "شركات ضيافة الحجاج" محل عبارة "شركات أرباب الطوائف" أينما وردت في النظام، وذلك بموجب  المرسوم الملكي رقم (م/89) وتاريخ 1447/5/12هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '0e3239b33e7fbf6c3bee074aa85a6eeb'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6lncb0a55cwg2gjl25kf5') = 'e7fc4546992ea5760d76651e32756749'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6lncb0a55cwg2gjl25kf5' AND valid_from='2025-11-03'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-3de60256716ecea5e29f5c4a' id,'cmpzcvdug0c9lvtrk6v8lqeij' unit_id,'1- تعقد اجتماعات المجلس في مقر الهيئة، ويجوز عند الاقتضاء عقدها في مكان آخر داخل المملكة.
2- يعقد المجلس اجتماعاته بصفة دورية أربع مرات في السنة، ولرئيس المجلس دعوته للاجتماع متى دعت الحاجة إلى ذلك أو متى طلب ذلك (ثلاثة) أعضاء على الأقل.
3- يكون اجتماع المجلس صحيحاً إذا حضره أغلبية الأعضاء بمن فيهم رئيس المجلس أو من ينيبه من ممثلي الجهات الحكومية الأعضاء في المجلس، وتصدر القرارات بأغلبية أصوات الحاضرين، وفي حالة تساوي الأصوات يرجح الجانب الذي صوت معه رئيس الاجتماع.
4- تثبت مداولات المجلس وقراراته في محاضر يوقعها رئيس الاجتماع والأعضاء الحاضرون.
5- لا يجوز لعضو المجلس الامتناع عن التصويت أو تفويض عضو آخر بالتصويت عنه عند غيابه، وللعضو المعترض تسجيل اعتراضه وأسباب الاعتراض ضمن محضر اجتماع المجلس.
6- لا يجوز للعضو أن يفشي شيئاً مما وقف عليه من أسرار الهيئة بسبب عضويته في المجلس.
7- للمجلس دعوة من يرى الاستعانة بهم من المختصين والمستشارين لحضور اجتماعاته، دون أن يكون لهم حق التصويت.' body,'2023-03-14'::timestamptz valid_from,'قرار مجلس الوزراء رقم 586 وتاريخ 1444/8/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9a1c4977-c539-4e01-8c88-a9a700f2efa9/1' eu,'- إحلال عبارة "أو من ينيبه من ممثلي الجهات الحكومية الأعضاء في المجلس" محل عبارة "أو نائبه" الواردة في الفقرة (3) وذلك بموجب قرار مجلس الوزراء رقم (586) وتاريخ 1444/8/22هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '3b5df8adc2eceba7caf95ea1a164521e'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvdug0c9lvtrk6v8lqeij') = '719c927b42a22af267700566b1ef3557'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvdug0c9lvtrk6v8lqeij' AND valid_from='2023-03-14'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0b227c89f1c7e5541348d2f2' id,'cmpzcv2ti096cvtrkaex7q60q' unit_id,'1- تكوّن بقرار من الوزير لجنة من ثلاثة أعضاء، يكون أحدهم -على الأقل- مستشاراَ شرعياَ أو نظامياَ، للنظر في المخالفات وتطبيق الغرامات المنصوص عليها في المواد (الخامسة والسبعين، والسادسة والسبعين، والسابعة والسبعين) من هذا النظام
2 - تعتمد قرارات اللجنة من الرئيس، ويحق لمن صدر ضده القرار التظلم منه أمام ديوان المظالم وفقاً لنظامه.
3 - تحدد اللوائح آلية عمل اللجنة، ومكافآت أعضائها.' body,'2021-03-25'::timestamptz valid_from,'مرسوم ملكي رقم م/67 وتاريخ 1442/8/12هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/a7d4493b-7c03-4c2d-b3c6-a9a700f275cd/1' eu,'- عُدلت الفقرة (1) من هذه المادة وذلك بموجب المرسوم الملكي رقم (م/67) وتاريخ 1442/8/12هـ، لتصبح بالنص الآتي: 

"1- تكوّن بقرار من الوزير لجنة من ثلاثة أعضاء، يكون أحدهم -على الأقل- مستشاراَ شرعياَ أو نظامياَ، للنظر في المخالفات وتطبيق الغرامات المنصوص عليها في المواد (الخامسة والسبعين، والسادسة والسبعين، والسابعة والسبعين) من هذا النظام".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2e60241307b08beebb5f8e0b3a7c5e5b'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv2ti096cvtrkaex7q60q') = '5216e1712d8f49d1b7466c590df1ccba'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv2ti096cvtrkaex7q60q' AND valid_from='2021-03-25'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-2cb66c246a4895d353e4ec98' id,'cmpzcvduh0caivtrk53hf7zan' unit_id,'في حالة عجز مقدم الطلب عن إكمال تنفيذ الطريق، فإن الجهة المختصة غير ملزمة بإكماله إلا وفق أولويته وفي حدود البرامج التي تنظم تنفيذ الطرق ووجود الاعتمادات المالية لذلك.' body,'2023-03-14'::timestamptz valid_from,'قرار مجلس الوزراء رقم 586 وتاريخ 1444/8/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b359badb-2ea0-4cbc-bbfb-a9a700f2f11b/1' eu,'- إحلال عبارة "الجهة المختصة" محل عبارة "الوزارة المختصة" وذلك بموجب قرار مجلس الوزراء رقم (586) وتاريخ 1444/8/22هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '1c598ec1cf975eaa3beb2510bde746f6'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvduh0caivtrk53hf7zan') = '71c6aee4fcdf2d1af3c017cbea5c7498'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvduh0caivtrk53hf7zan' AND valid_from='2023-03-14'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-04d83242ee469190d05ee7ea' id,'cmpzcvduh0cahvtrkim9gg6gj' unit_id,'بعد إنجاز الطريق وفقاً للمواصفات والشروط التي صدر بموجبها الإذن النهائي، - وسواء كان الطريق مسفلتاً أم ترابياً – تقوم الجهة المختصة بتسلمه وضمه إلى برامج صيانة الطرق لديها ويصبح من مسؤوليتها، ويعامل كغيره من الطرق التي تدخل في نطاق اختصاصها.' body,'2023-03-14'::timestamptz valid_from,'قرار مجلس الوزراء رقم 586 وتاريخ 1444/8/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/b359badb-2ea0-4cbc-bbfb-a9a700f2f11b/1' eu,'- إحلال عبارة "الجهة المختصة" محل عبارة "الوزارة المختصة" الواردة في هذا البند، وذلك بموجب قرار مجلس الوزراء رقم (586) وتاريخ 1444/8/22هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '9f667d9cd113a29a41c046a3dcbe50d1'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcvduh0cahvtrkim9gg6gj') = '0ecd5544b1490e26b513e689134c1846'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcvduh0cahvtrkim9gg6gj' AND valid_from='2023-03-14'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-0d24b22195881af52b387ead' id,'cmpzcv8z00axmvtrki7x3vchp' unit_id,'1- تفرض على صاحب العمل الذي يخالف أي حكم من أحكام هذا النظام واللائحة غرامة لا تزيد على (10,000) عشرة آلاف ريال، ويضاعف هذا الحد في حال التكرار، وتتعدد الغرامة بتعدد العمال المشتركين الذين ارتكب صاحب العمل بصددهم مخالفة أو أكثر.
2- مع عدم الإخلال بأي عقوبة أشد يقررها نظام آخر، تفرض على كل شخص يقدم متعمداً بيانات غير صحيحة – لأجل إفادة غيره من التعويضات بغير وجه حق – غرامة لا تزيد على (2,000) ألفي ريال، ويضاعف هذا الحد في حال التكرار.
3- مع عدم الإخلال بأي عقوبة أشد يقررها نظام آخر، تفرض على الشخص الذي يقدم بيانات غير صحيحة – لأجل الاستفادة من التعويضات - غرامة لا تتجاوز قيمتها قيمة التعويضات التي دفعت له دون وجه حق، إضافة إلى إلزامه برد ما دفع من تلك التعويضات.
4- تكوّن لجان للتحقيق في مكاتب المؤسسة أو الوزارة؛ للنظر في المخالفات وتحديد العقوبات.
5- يصدر القرار بفرض الغرامة المنصوص عليها في الفقرات السابقة من وزير الموارد البشرية والتنمية الاجتماعية أو محافظ المؤسسة بحسب الاختصاص، ويجوز لصاحب الشأن الاعتراض على القرار خلال ثلاثين يوماً من تاريخ إبلاغه بالقرار وفق أحكام المادتين (الثالثة والعشرين) و(الرابعة والعشرين) من هذا النظام، بحسب الحال.
6- لا يجوز فرض أي من الغرامات المنصوص عليها في هذه المادة عن المخالفات التي مضى عليها خمس سنوات فأكثر.
7- تؤول مبالغ الغرامات المنصوص عليها في هذه المادة للحساب الخاص بهذا النظام.' body,'2021-03-09'::timestamptz valid_from,'قرار مجلس الوزراء رقم 419 وتاريخ 1442/7/25هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c331efa7-58ec-48c9-b70e-a9a700f2ba82/1' eu,'- إحلال عبارة (وزير الموارد البشرية والتنمية الاجتماعية) محل عبارة (الوزير) الواردة في الفقرة (5) من هذه المادة. وذلك بموجب قرار مجلس الوزراء رقم (419) وتاريخ 1442/7/25هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'bf764bd0d2f89c01785d36d38bc18ee2'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv8z00axmvtrki7x3vchp') = 'a17bccbdc1d3cdb60d00431c050b29d7'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv8z00axmvtrki7x3vchp' AND valid_from='2021-03-09'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-742f5f74818d82c7844519e7' id,'cmpz5uj2400wvcwg2f1a6u0d1' unit_id,'مجلس الإدارة :

أ - يكون لكل مؤسسة مجلس إدارة يتكون من:

1 - عدد من أعضاء المؤسسة لا يقل عن ستة.

2 - المدير العام ورؤساء التحرير في المؤسسة، على ألا يزيد عددهم على ثلث مجموع أعضاء مجلس الإدارة .

ب - يختار أعضاء مجلس الإدارة بالأغلبية المطلقة من بينهم رئيساً له في أول اجتماع يعقدونه، على ألا يكون المدير العام، أو رئيس التحرير .' body,'2021-01-07'::timestamptz valid_from,'مرسوم ملكي رقم م/46 وتاريخ 1442/5/23هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c385b62c-c635-484c-afa1-a9a700f16fe1/1' eu,'- إحلال عبارة "رئيساً له" محل عبارة "رئيساً للمجلس" الواردة في الفقرة (ب) من هذه المادة، وذلك بموجب المرسوم الملكي رقم (م/46) وتاريخ 1442/5/23هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '263f883925afff746497a7a9bf06b020'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5uj2400wvcwg2f1a6u0d1') = '11e903450d101534667a9de867736b08'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5uj2400wvcwg2f1a6u0d1' AND valid_from='2021-01-07'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-5a587861c1f98a93b767ac5c' id,'cmpzcut6e06jpvtrkecnwigfd' unit_id,'مع عدم الإخلال بأي عقوبة أشد تنص عليها أنظمة أخرى، يعاقب كل من يخالف أي حكم من أحكام هذا النظام أو لوائحه التنفيذية وفقا لما يأتي:
1 - غرامة مالية لا تقل عن ألف ريال ولا تزيد على خمسين ألف ريال، مع إزالة موضوع المخالفة وإصلاح ما تلف بسببها على نفقة المخالف، وأخذ التعهد اللازم بعدم تكرار مخالفة أحكام هذا النظام.
2 - في حالة تكرار المخالفة لأحكام هذا النظام تشد العقوبة، ويجوز قفل مياه الصرف الصحي المعالجة عن المخالف لمدة لا تزيد على ستة أشهر، ويجوز تضمين قرار العقوبة النص على نشر منطوقه على نفقة المخالف في صحيفة محلية تصدر في مكان إقامته، فإن لم يكن في مكان إقامته صحيفة ففي أقرب منطقة له، أو نشره في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة وجسامتها وآثارها، على أن يكون نشر القرار بعد تحصنه بمضي المدة المحددة نظاماً أو تأييده من المحكمة المختصة' body,'2017-01-17'::timestamptz valid_from,'مرسوم ملكي رقم م/39 وتاريخ 19/4/1438هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c440e774-b1d8-42f5-9169-a9a700f24951/1' eu,'تم تعديل الفقرة (2) من هذه المادة بموجب المرسوم الملكي رقم (م/ 39) بتاريخ 19/ 4/ 1438هـ، لتصبح بالنص الآتي:

"في حالة تكرار المخالفة لأحكام هذا النظام تشد العقوبة، ويجوز قفل مياه الصرف الصحي المعالجة عن المخالف لمدة لا تزيد على ستة أشهر، ويجوز تضمين قرار العقوبة النص على نشر منطوقه على نفقة المخالف في صحيفة محلية تصدر في مكان إقامته، فإن لم يكن في مكان إقامته صحيفة ففي أقرب منطقة له، أو نشره في أي وسيلة أخرى مناسبة، وذلك بحسب نوع المخالفة المرتكبة وجسامتها وآثارها، على أن يكون نشر القرار بعد تحص' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '2e0c687093a886137652a4de1c23203c'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcut6e06jpvtrkecnwigfd') = '43a16a986992bbdac2c9519b42404bf2'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcut6e06jpvtrkecnwigfd' AND valid_from='2017-01-17'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b6108658d818f59987de93af' id,'cmpz6ai2x0685cwg26bby2nbt' unit_id,'أ ـ تشكل في الهيئة بقرار من المجلس لجنة تسمى (لجنة قيد المقيّمين)، من ثلاثة أعضاء يكون من بينهم مستشار قانوني، ومقيّم مزاول من كل فرع من فروع التقييم المختلفة.

ويسمي المجلس من يحل محل العضو عند غيابه، وتكون مدة العضوية في اللجنة (ثلاث) سنوات، قابلة للتجديد مدداً مماثلة

1  -  مسؤول من الوزارة لا تقل مرتبته عن المرتبة الرابعة عشرة (رئيساً).
2  ـ  مستشار قانوني (عضواً).
3 ـ مقيّم مزاول للمهنة من كل فرع من فروع التقييم المختلفة يرشحهم مجلس إدارة الهيئة (عضواً).
ويسمي الوزير من يحل محل العضو عند غيابه، وتكون مدة العضوية في اللجنة ثلاث سنوات قابلة للتجديد مدداً مماثلة.

ب ـ تنعقد اللجنة بحضور جميع أعضائها وتصدر قراراتها بالأغلبية، على أن يقتصر تمثيل المقيّمين في اجتماع اللجنة على المقيّم المزاول للمهنة في الفرع الوارد في طلب القيد. وتبت اللجنة في طلب القيد وفقاً لما يحدده هذا النظام ولائحته التنفيذية، على أن يكون القرار مسبباً في حال رفض الطلب، ويجوز لصاحب الطلب ـ إذا رفضت اللجنة طلبه ـ التظلم أمام ديوان المظالم وفقاً لنظامه.' body,'2023-06-11'::timestamptz valid_from,'مرسوم ملكي رقم م/190 وتاريخ 1444/11/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cad66e4d-38d3-4baa-8049-a9a700f1e7a8/1' eu,'- عُدلت الفقرة (أ) وذلك بموجب المرسوم الملكي رقم (م/190) وتاريخ 1444/11/22هـ، لتكون بالنص الآتي:

" تشكل في الهيئة بقرار من المجلس لجنة تسمى (لجنة قيد المقيّمين)، من ثلاثة أعضاء يكون من بينهم مستشار قانوني، ومقيّم مزاول من كل فرع من فروع التقييم المختلفة.

ويسمي المجلس من يحل محل العضو عند غيابه، وتكون مدة العضوية في اللجنة (ثلاث) سنوات، قابلة للتجديد مدداً مماثلة".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '97e92dcab002442ec54e0eda2ff2fab9'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6ai2x0685cwg26bby2nbt') = '035d68c5defa2251464d162d09765afe'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6ai2x0685cwg26bby2nbt' AND valid_from='2023-06-11'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-9478f93e6f8f35623fa557d2' id,'cmpz6akaz068xcwg2aaqbhbyi' unit_id,'1 - يجب على المقيّم المعتمد إذا توقف عن مزاولة المهنة لأي سبب من الأسباب بصورة مؤقتة أو نهائية أن يبلغ الوزارة والعميل بذلك خلال ثلاثين يوماً من تاريخ توقفه ، ويعد الترخيص منتهياً في حالة التوقف النهائي . ودون إخلال بالجزاءات المنصوص عليها في هذا النظام يكون للوزارة صلاحية طلب إصدار قرار - من اللجنة المنصوص عليها في المادة (الرابعة والثلاثين) من هذا النظام - بإلغاء ترخيص كل مقيّم معتمد توقف عن مزاولة المهنة ، ولم يتقدم بالإبلاغ المنصوص عليه في هذه المادة خلال الموعد المحدد بعد التحقق من الواقعة المستوجبة لذلك ، وسماع أقوال المقيّم المعتمد ، وإذا أبلغ المقيّم المعتمد ولم يحضر خلال الثلاثين يوماً التالية لتاريخ إبلاغه يلغى ترخيصه ، ويجوز له التظلم من قرار إلغاء الترخيص أمام ديوان المظالم، ولا يترتب على إلغاء الترخيص إلغاء العضوية في الهيئة .
2- في حالة توقف المقيّم المعتمد عن مزاولة مهنته نهائياً ، أو لمدة يترتب عليها الإضرار بالعملاء أو الغير ، فعليه أن يصفي جميع المعاملات المعلقة لديه ، والحقوق والالتزامات المترتبة على ذلك طبقاً للقواعد والإجراءات التي تحددها اللائحة التنفيذية.' body,'2023-06-11'::timestamptz valid_from,'مرسوم ملكي رقم م/190 وتاريخ 1444/11/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cad66e4d-38d3-4baa-8049-a9a700f1e7a8/1' eu,'- إحلال كلمة "الهيئة" محل عبارة "الجهة المشرفة"، و حذف كلمة "والهيئة" الواردة قبل عبارة "والعميل بذلك خلال". وذلك بموجب المرسوم الملكي رقم (م/190) وتاريخ 1444/11/22هـ،' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'a192e164d6db7ed8ac56f30273caae3d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6akaz068xcwg2aaqbhbyi') = 'd36a61f90e645818fbc90dde7bdeac2a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6akaz068xcwg2aaqbhbyi' AND valid_from='2023-06-11'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b11ee59cbaa2d9fc78ee524c' id,'cmpz6akxy0695cwg2ivagtyjk' unit_id,'1 - يكون للهيئة جمعية عمومية تتكون من جميع الأعضاء الأساسيين الذين سددوا اشتراكاتهم السنوية .
2 - تعقد الجمعية العمومية للهيئة اجتماعاتها العادية أو الاستثنائية بحضور أغلبية أعضائها، فإن لم يتوافر النصاب اللازم للاجتماع، وُجهت دعوة لموعد اجتماع لاحق يعقد خلال الثلاثين يوماً التالية للموعد السابق، على ألاّ تقل المدة بين الموعدين عن خمسة عشر يوماً ، ويكون اجتماع الجمعية العمومية للهيئة في هذا الموعد صحيحاً مهما كان عدد الحاضرين. وتعقد الاجتماعات العادية للجمعية العمومية للهيئة بدعوة من مجلس الإدارة في موعد يحدد في بداية كل عام مالي للهيئة . ويجوز للجمعية العمومية للهيئة عقد اجتماعات استثنائية بناءً على طلب خُمس أعضائها أو طلب مجلس الإدارة.
3- يرأس الجمعية العمومية رئيس مجلس إدارة الهيئة أو من ينيبه في حال غيابه، وتصدر قرارات الجمعية العمومية للهيئة بأغلبية أصوات الحاضرين، وعند تساوي الأصوات يرجح الجانب الذي صوت معه رئيس الاجتماع.' body,'2023-06-11'::timestamptz valid_from,'مرسوم ملكي رقم م/190 وتاريخ 1444/11/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cad66e4d-38d3-4baa-8049-a9a700f1e7a8/1' eu,'- حذف عبارة "والمنتسبين" الواردة في الفقرة (1) من هذه المادة، وذلك بموجب المرسوم الملكي رقم (م/190) وتاريخ 1444/11/22هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'a63fcb48dd1dd767eaa7f0786355096d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6akxy0695cwg2ivagtyjk') = '4d52bd217849576a3c81b6e2baa70fe9'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6akxy0695cwg2ivagtyjk' AND valid_from='2023-06-11'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8be208fff17d158808af48fb' id,'cmpz6al3o0697cwg23zpi50s6' unit_id,'تختص الجمعية العمومية للهيئة بما يلي :

1 - اعتماد تقرير مجلس الإدارة السنوي عن نشاط الهيئة.
2 - إقرار الحسابات الختامية للهيئة.
3 - تعيين مراجعي حسابات الهيئة وتحديد أتعابهم.
4 - انتخاب أعضاء مجلس إدارة الهيئة من المقيّمين المعتمدين
5 - مناقشة كل ما يرد في جدول أعمالها من أمور تدخل في نطاق عمل الهيئة أو اهتماماتها.' body,'2020-04-15'::timestamptz valid_from,'مرسوم ملكي رقم م/109 وتاريخ 1441/8/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/cad66e4d-38d3-4baa-8049-a9a700f1e7a8/1' eu,'عُدلت الفقرة (4) من هذه المادة بموجب المرسوم الملكي رقم (م/109) وتاريخ 1441/8/22هــ، لتكون بالنص الآتي: "انتخاب أعضاء مجلس إدارة الهيئة من المقيّمين المعتمدين".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '62f06eebbaddaf77ac4c59d2da551a1d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6al3o0697cwg23zpi50s6') = '57debb1122ef8f0a60232b44dbb9ad65'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6al3o0697cwg23zpi50s6' AND valid_from='2020-04-15'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8bb8e16ea482d84098347e0e' id,'cmpz5xmce01ybcwg2zcvebpg7' unit_id,'( يجوز منح الجنسية العربية السعودية بقرار من وزير الداخلية لمن ولد داخل المملكة العربية السعودية من أب أجنبي وأم سعودية إذا توفرت الشروط التالية:

أ- أن تكون له صفة الإقامة الدائمة في المملكة العربية السعودية عند بلوغه سن الرشد.

ب- أن يكون حسن السيرة والسلوك ولم يسبق الحكم عليه بحكم جنائي أو بعقوبة السجن لجريمة أخلاقية لمدة تزيد عن ستة شهور.

جـ- أن يجيد اللغة العربية.

د- أن يقدم خلال السنة التالية لبلوغه سن الرشد طلباً بمنحه الجنسية العربية السعودية).' body,'1985-02-14'::timestamptz valid_from,'مرسوم ملكي رقم م/14 وتاريخ 1405/5/24هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d9f183b6-3afc-4405-834f-a9a700f18571/1' eu,'- عُدلت هذه المادة وذلك بموجب المرسوم الملكي رقم (م/14) وتاريخ 1405/5/24هـ، لتصبح بالنص الآتي: 

( يجوز منح الجنسية العربية السعودية بقرار من وزير الداخلية لمن ولد داخل المملكة العربية السعودية من أب أجنبي وأم سعودية إذا توفرت الشروط التالية:

أ- أن تكون له صفة الإقامة الدائمة في المملكة العربية السعودية عند بلوغه سن الرشد.

ب- أن يكون حسن السيرة والسلوك ولم يسبق الحكم عليه بحكم جنائي أو بعقوبة السجن لجريمة أخلاقية لمدة تزيد عن ستة شهور.

جـ- أن يجيد اللغة العربية.

د- أن يقدم خلال السنة التالية' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'fc1515e9938a3033327123c30f162674'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5xmce01ybcwg2zcvebpg7') = '71006870f2ff9e1c3aeaaefd119f4635'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5xmce01ybcwg2zcvebpg7' AND valid_from='1985-02-14'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-8bbb88c0a2b5eb25754e2bfe' id,'cmpz5xmce01ybcwg2zcvebpg7' unit_id,'( يجوز منح الجنسية العربية السعودية بأمر من رئيس مجلس الوزراء بناءً على اقتراح وزير الداخلية لمن ولد داخل المملكة العربية السعودية من أب أجنبي وأم سعودية إذا توفرت الشروط التالية:

أ- أن تكون له صفة الإقامة الدائمة في المملكة العربية السعودية عند بلوغه سن الرشد.

ب- أن يكون حسن السيرة والسلوك ولم يسبق الحكم عليه بحكم جنائي أو بعقوبة السجن لجريمة أخلاقية لمدة تزيد عن ستة شهور.

جـ- أن يجيد اللغة العربية.

د- أن يقدم خلال السنة التالية لبلوغه سن الرشد طلباً بمنحه الجنسية العربية السعودية).' body,'2023-01-04'::timestamptz valid_from,'مرسوم ملكي رقم م/88 وتاريخ 1444/6/11هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d9f183b6-3afc-4405-834f-a9a700f18571/1' eu,'- عُدلت هذه المادة وذلك بموجب المرسوم الملكي رقم (م/88) وتاريخ 1444/6/11هـ، وذلك بإحلال عبارة "بأمر من رئيس مجلس الوزراء بناءً على اقتراح وزير الداخلية" محل عبارة "بقرار من وزير الداخلية".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '641cbab077ad7a0ac16df22423249a72'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz5xmce01ybcwg2zcvebpg7') = '71006870f2ff9e1c3aeaaefd119f4635'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz5xmce01ybcwg2zcvebpg7' AND valid_from='2023-01-04'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-b330a1fa85ef6d40a34b1cfd' id,'cmpzcv4vm09sivtrkm769qmlk' unit_id,'يصرف لكل من المريض الذي يعالج خارج المملكة ومرافقه بالإضافة إلى ما ذكر أعلاه ما يلي :
أ- (5000) خمسة آلاف ريال بدل تجهيز لمرة واحدة

ب - ألف (1000) ريال شهرياً مقابل خدمة للمريض شديد الإعاقة الذي لا يستطيع خدمة نفسه على أن يحدد ذلك في قرار الهيئة الطبية.' body,'2020-04-21'::timestamptz valid_from,'قرار مجلس الوزراء رقم 557 وتاريخ 1441/8/28هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/de7dfbea-f1ca-4cd0-b664-a9a700f28e01/1' eu,'-عُدلت الفقرة (أ) من هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (557) وتاريخ 1441/8/28هـ، لتكون بالنص الآتي:

" أ- (5000) خمسة آلاف ريال بدل تجهيز لمرة واحدة ".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '35ae193cec6c41693e908a744284c263'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv4vm09sivtrkm769qmlk') = 'f8f4655fc9264e87ad70900e9f54e42d'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv4vm09sivtrkm769qmlk' AND valid_from='2020-04-21'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-e33f04cc8c3d623346fc3ea2' id,'cmpzcv6wo0aaxvtrkil90ko18' unit_id,'يكون توزيع غاز البترول السائل للأغراض السكنية والتجارية مقصوراً على المناطق التي ليست فيها شبكة توزيع غاز جاف، وبما لا يتجاوز الكمية اليومية التي تحددها الوزارة .' body,'2022-06-08'::timestamptz valid_from,'مرسوم ملكي رقم م/112 وتاريخ 1443/11/9هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e4436403-31ee-439c-bac4-a9a700f2a17d/1' eu,'- حذف عبارة "لكل مستهلك" الواردة في عجز المادة ، وذلك بموجب المرسوم الملكي رقم (م/112) وتاريخ 1443/11/9هـ' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '4f3c82bfe24ceb2d316905da12f8778d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6wo0aaxvtrkil90ko18') = '9af4081d3d56cfee4c3cb9b5603e0d6d'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6wo0aaxvtrkil90ko18' AND valid_from='2022-06-08'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-a4ada0861319e7494dda8ece' id,'cmpwibbf101w5nxff7zbi861j' unit_id,'يجب أن يكون الحكم مشمولًا بالتنفيذ المعجل، بكفالة أو بدونها حسب تقدير القاضي، وذلك في الأحوال الآتية:

أ - الأحكام الصادرة في الأمور المستعجلة.
ب- إذا كان الحكم صادراً بتقرير نفقة، أو أجرة رضاع، أو سكن، أو رؤية صغير، أو تسليمه إلى حاضنه، أو تفريق بين زوجين

ج - إذا كان الحكم صادرًا بأداء أجرة خادم، أو صانع، أو عامل، أو مرضع، أو حاضن.' body,'2021-06-03'::timestamptz valid_from,'مرسوم ملكي رقم م/92 وتاريخ 1442/10/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1' eu,'- عُدلت الفقرة (ب) من هذه المادة وذلك بموجب المرسوم الملكي رقم (م/92) وتاريخ 1442/10/22هـ، لتصبح بالنص الآتي: "ب- إذا كان الحكم صادراً بتقرير نفقة، أو أجرة رضاع، أو سكن، أو رؤية صغير، أو تسليمه إلى حاضنه، أو تفريق بين زوجين".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'e84d4126b12996c1606eabeb2f458be4'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpwibbf101w5nxff7zbi861j') = 'f253188471a1c28da033ad96ecd7cd70'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpwibbf101w5nxff7zbi861j' AND valid_from='2021-06-03'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-7cceeedb8ee7d7c9a1ed5b8f' id,'cmpwibt1u01z3nxff4y5zddim' unit_id,'مع مراعاة أحكام تملك غير السعوديين للعقار، لا يجوز تسجيل وقفية عقار في المملكة مملوك لغير سعودي إلا بالشروط الآتية:

أ - أن يكون الوقف طبقًا للمقتضيات الشرعية.

ب - أن يكون الوقف على جهة بر لا تنقطع.

ج - أن يكون الوقف على أفراد سعوديين أو على جهات خيرية سعودية.

د - أن يكون الناظر على الوقف سعوديًا.
هـ - أن ينص في صك الوقف على أن يكون للهيئة العامة للأوقاف حق الإشراف على الوقف

و - أن يكون الوقف خاضعًا لنظام الأوقاف في المملكة.' body,'2021-06-24'::timestamptz valid_from,'مرسوم ملكي رقم م/101 وتاريخ 1442/11/14هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1' eu,'- عُدلت الفقرة (هـ) من هذه المادة وذلك بموجب المرسوم الملكي رقم (م/101) وتاريخ 1442/11/14هـ، لتكون بالنص الآتي:

"هـ - أن ينص في صك الوقف على أن يكون للهيئة العامة للأوقاف حق الإشراف على الوقف".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '23e679eed7318691a433593784eb4830'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpwibt1u01z3nxff4y5zddim') = 'c5e828d6e13523335d6c7a21db2edbcc'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpwibt1u01z3nxff4y5zddim' AND valid_from='2021-06-24'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-798437cfe8ae0119aca62ac0' id,'cmpzcv6870a5dvtrk9prp8wd9' unit_id,'يجتمع المجلس بدعوة من رئيسه مرة واحدة على الأقل كل ثلاثة أشهر، وعلى الرئيس دعوة المجلس إذا طلب ذلك نصف الأعضاء على الأقل، ويجب أن تشتمل الدعوة على جدول الأعمال، ويشترط لصحة الاجتماع حضور أغلبية الأعضاء بمن فيهم رئيس المجلس أو من ينيب، وتصدر القرارات بأغلبية أصوات الحاضرين وفي حالة تساوي الأصوات يرجح الجانب الذي يصوت معه رئيس الجلسة، وللمجلس أن يدعو لحضور جلساته من يرى الاستعانة بمعلوماتهم وخبراتهم دون أن يكون لهم حق التصويت، وتثبت مداولات المجلس وقراراته في محاضر يوقعها رئيس الجلسة والأعضاء الحاضرون. ولا يجوز للمجلس أن يصدر قرارات بطريق عرضها على الأعضاء متفرقين إلا في حالة الضرورة، ويشترط عندئذ موافقة جميع أعضاء المجلس على القرارات كتابة، وتعرض هذه القرارات على المجلس في أول اجتماع لاحق لإثباتها في محضر الاجتماع.' body,'2021-03-02'::timestamptz valid_from,'قرار مجلس الوزراء رقم 403 وتاريخ 1442/7/18هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f9bd197e-980e-4e9f-948c-a9a700f2994e/1' eu,'- عُدلت هذه المادة وذلك بموجب قرار مجلس الوزراء رقم (403) وتاريخ 1442/7/18هـ. وذلك بإحلال عبارة "أو من ينيب" محل عبارة "أو نائبه".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '988a0236cfa9ddb399ef23c4992a294d'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv6870a5dvtrk9prp8wd9') = '340656d90ac610284bba6d4b223d31d8'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv6870a5dvtrk9prp8wd9' AND valid_from='2021-03-02'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-d0018c92331610ff5ba5ca2f' id,'cmpz6chsb06wncwg2g4iaqjmw' unit_id,'يكون للصندوق محافظ يعين في منصبه ويعفى منه بقرار من المجلس، ويحدد قرار تعيينه أجره ومزاياه المالية الأخرى، ويعد المسؤول التنفيذي للصندوق، ويتخذ ما يراه محققاً لأهدف الصندوق ومهماته، وتتركز مسؤولياته في حدود التنظيم وما يقرره المجلس، ويتولى الاختصاصات الآتية:

1- اقتراح الاستراتيجيات المتعلقة بنشاط الصندوق، والخطط والبرامج اللازمة لتنفيذها ورفعها إلى المجلس.

2- الإشراف على سير العمل في الصندوق من خلال اللوائح والخطط والبرامج المعتمدة.

3- اقتراح هيكل الصندوق التنظيمي، ورفعه إلى المجلس.

4- اقتراح اللوائح الإدارية والمالية التي يسير عليها الصندوق، وغيرها من اللوائح والإجراءات الداخلية والفنية اللازمة لتسيير شؤون الصندوق وعمله؛ تمهيداً لرفعها إلى المجلس.

5- متابعة أداء عمل الصناديق والبنوك التنموية وفقاً لما يقره المجلس من آليات ومعايير.

6- اتخاذ ما يلزم لإعداد مشروعات تحديثات اختصاصات واستراتيجيات وتنظيمات وهياكل تلك الصناديق والبنوك التنموية وخططها التنفيذية وآليات التمويل والإقراض المعمول بها فيها، وعرضها على المجلس.

7- الإشراف على إعداد مشروع ميزانية الصندوق وحسابه الختامي والتقرير السنوي؛ تمهيداً لعرضها على المجلس.

8- الإشراف على إعداد التقارير الدورية عن سير العمل في الصندوق، وعرضها على المجلس.

9- التوقيع على الاتفاقات والبروتوكولات بعد موافقة المجلس، ووفقاً للإجراءات النظامية المتبعة.

10- تمثيل الصندوق أمام الجهات الحكومية والمؤسسات الأخرى ذات العلاقة، وغيرها من الجهات داخل المملكة وخارجها، وأمام القضاء، وله تفويض غيره في ذلك. 

11- الصرف من ميزانية الصندوق، واتخاذ جميع الإجراءات المالية وفقاً للأنظمة واللوائح المقرة، وفي حدود الصلاحيات التي فوضه المجلس فيها.

12- التعاقد لتنفيذ الأعمال والخدمات وغيرها، وفقاً للصلاحيات التي يفوضه المجلس فيها.

13- إصدار القرارات اللازمة لتنفيذ الأحكام الواردة في التنظيم واللوائح الصادرة بناءً عليه، بحسب الصلاحيات المخولة له.

14- تعيين منسوبي الصندوق وفقاً للوائح المنظمة لذلك، والإشراف عليهم.

15- أي اختصاص آخر يسنده إليه المجلس.

وللمحافظ تفويض بعض اختصاصاته إلى من يراه من منسوبي الصندوق.

 ' body,'2019-05-07'::timestamptz valid_from,'قرار مجلس الوزراء رقم 505 وتاريخ 2/9/1440هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/fd05e9ef-bf19-4766-9121-a9ec01152301/1' eu,'-عُدلت هذه المادة بموجب قرار مجلس الوزراء رقم (505) وتاريخ 2 /9 / 1440هـ، وذلك بإحلال عبارة "يكون للصندوق محافظ يعين في منصبه ويعفى منه بقرار من المجلس، ويحدد قرار تعيينه أجره ومزاياه المالية الأخرى" محل عبارة "يكون للصندوق محافظ بمرتبة وزير يعين بأمر ملكي" الواردة في صدر المادة.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'ac44096791d672316384ec0e39479972'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6chsb06wncwg2g4iaqjmw') = '000d91a77be4b0c4c07e37addc82a21a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6chsb06wncwg2g4iaqjmw' AND valid_from='2019-05-07'::timestamptz);
INSERT INTO unit_version (id,unit_id,body,valid_from,evidence_instrument,evidence_url,evidence_quote)
SELECT * FROM (SELECT 'boe26-f9d06471f7ed3984b872f3cc' id,'cmpz6chsb06wncwg2g4iaqjmw' unit_id,'يكون للصندوق محافظ يعين بأمر ملكي، ويعد المسؤول التنفيذي للصندوق، ويتخذ ما يراه محققاً لأهدف الصندوق ومهماته، وتتركز مسؤولياته في حدود التنظيم وما يقرره المجلس، ويتولى الاختصاصات الآتية:

1- اقتراح الاستراتيجيات المتعلقة بنشاط الصندوق، والخطط والبرامج اللازمة لتنفيذها ورفعها إلى المجلس.

2- الإشراف على سير العمل في الصندوق من خلال اللوائح والخطط والبرامج المعتمدة.

3- اقتراح هيكل الصندوق التنظيمي، ورفعه إلى المجلس.

4- اقتراح اللوائح الإدارية والمالية التي يسير عليها الصندوق، وغيرها من اللوائح والإجراءات الداخلية والفنية اللازمة لتسيير شؤون الصندوق وعمله؛ تمهيداً لرفعها إلى المجلس.

5- متابعة أداء عمل الصناديق والبنوك التنموية وفقاً لما يقره المجلس من آليات ومعايير.

6- اتخاذ ما يلزم لإعداد مشروعات تحديثات اختصاصات واستراتيجيات وتنظيمات وهياكل تلك الصناديق والبنوك التنموية وخططها التنفيذية وآليات التمويل والإقراض المعمول بها فيها، وعرضها على المجلس.

7- الإشراف على إعداد مشروع ميزانية الصندوق وحسابه الختامي والتقرير السنوي؛ تمهيداً لعرضها على المجلس.

8- الإشراف على إعداد التقارير الدورية عن سير العمل في الصندوق، وعرضها على المجلس.

9- التوقيع على الاتفاقات والبروتوكولات بعد موافقة المجلس، ووفقاً للإجراءات النظامية المتبعة.

10- تمثيل الصندوق أمام الجهات الحكومية والمؤسسات الأخرى ذات العلاقة، وغيرها من الجهات داخل المملكة وخارجها، وأمام القضاء، وله تفويض غيره في ذلك. 

11- الصرف من ميزانية الصندوق، واتخاذ جميع الإجراءات المالية وفقاً للأنظمة واللوائح المقرة، وفي حدود الصلاحيات التي فوضه المجلس فيها.

12- التعاقد لتنفيذ الأعمال والخدمات وغيرها، وفقاً للصلاحيات التي يفوضه المجلس فيها.

13- إصدار القرارات اللازمة لتنفيذ الأحكام الواردة في التنظيم واللوائح الصادرة بناءً عليه، بحسب الصلاحيات المخولة له.

14- تعيين منسوبي الصندوق وفقاً للوائح المنظمة لذلك، والإشراف عليهم.

15- أي اختصاص آخر يسنده إليه المجلس.

وللمحافظ تفويض بعض اختصاصاته إلى من يراه من منسوبي الصندوق.

 ' body,'2025-10-14'::timestamptz valid_from,'قرار مجلس الوزراء رقم 284 وتاريخ 1447/4/22هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/fd05e9ef-bf19-4766-9121-a9ec01152301/1' eu,'- إحلال عبارة "يكون للصندوق محافظ يعين بأمر ملكي" محل عبارة "يكون للصندوق محافظ يعين في منصبه ويعفى منه بقرار من المجلس، ويحدد قرار تعيينه أجره ومزاياه المالية الأخرى" الواردة في صدر المادة وذلك  بموجب قرار مجلس الوزراء رقم (284) وتاريخ 1447/4/22هـ.' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = '6092db14381276862a0cae323ac7f4d0'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpz6chsb06wncwg2g4iaqjmw') = '000d91a77be4b0c4c07e37addc82a21a'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpz6chsb06wncwg2g4iaqjmw' AND valid_from='2025-10-14'::timestamptz);
DO $c$ DECLARE k int; BEGIN
  SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-5478f9f99e9ed36516206336','boe26-e609ddbb78ed73718bf6d931','boe26-8ecdd8b80232e0ba8cdd0d78','boe26-064882aa6f8045019eb2b245','boe26-747ad045ce2475ee1f012aa2','boe26-a9c475e660a5eb28fe48b1fb','boe26-47e80d2b0733e7c71c912a83','boe26-9b02dbce2a3ad12600d5349c','boe26-f68a76088b3711c8bbef7b0a','boe26-eb4646a559be12b6c5482bd3','boe26-25b880e29cc09264e029d0ee','boe26-a638f3928c75025024ad5cce','boe26-69309af58125c3edfc3402b9','boe26-6fd9c3d5cbcbeeeb13b5b0d0','boe26-e7e6f1402eddf7d9d3df5e22','boe26-8aa064f147ec0f493950fec9','boe26-991fbb6748b62d7b4d605625','boe26-4f3c3845cbbfd3f96cd48e75','boe26-28862e7a5377d7b656ba1beb','boe26-6743f21864ae6b5a0653fb58','boe26-bed544611fbd7110f26ad712','boe26-d04753e5dc7991f9f5cf9f2d','boe26-0834d509422efac0b0688d40','boe26-b40d6a5ffac2989299a13ea4','boe26-46ac42cc96215c6236bb66ae','boe26-5f04576c512b3c453e7322ff','boe26-a99691e819fea7dda47a3b6b','boe26-5c6c16732830d68c7579cda0','boe26-a851ffcddbd44bc5516d2885','boe26-d2cd159254beaee82c98b8d3','boe26-bb838057a32aa65421a43b02','boe26-31e1198addfefb6eb8dab496','boe26-8c9d1f4a17a688b4fdacf428','boe26-bcb0c01920d38b1ce52a7090','boe26-ee0f96fdef8a78018b8891f3','boe26-0b7b9114b2980dbfef019f30','boe26-61e8613da977be8cf82ef153','boe26-8d5c24e51cc9ab02e0891a3a','boe26-9a479551c98176be1cfa0007','boe26-77f32ed9e8589bc56be77607','boe26-47b652da6facdd6ca358856e','boe26-fc1b3dc2223c9fdb4ace440b','boe26-5bd8b35419f876c99c353dd9','boe26-102bba11fe6921f1cc595692','boe26-0350286f2b215f172b690d64','boe26-54ff066de35c2a05aeb46f31','boe26-9fee71979a9701f14e145e08','boe26-d84e0fb48248e65227661d9a','boe26-c4d26882ba729e893c5198ff','boe26-b7070a6b4e5d142d5b20225b','boe26-856e3f3d072e8fc8d628a5f2','boe26-f1d8f640be5c5160d7eaeb84','boe26-c0b900a744b56667a2bce71f','boe26-62ae68895dd22294b26daae6','boe26-7d79e1aeb3cc7b04fc022276','boe26-ef76f8e273ad00ce9c55e136','boe26-1c07783de2765ed2302e0cbc','boe26-ba0ad77c6a9af665cb58d595','boe26-d869dfa7485eb1d399948fd0','boe26-e4aba3da99f4eed840dd70a6','boe26-b36f442deb45cf0cdf0df841','boe26-f56f54750f83666089aadeca','boe26-fc03e3c4ce7f437a13cac36a','boe26-0a7435d352cad485803071d3','boe26-4a1cbdf52910dec77e60e472','boe26-dfb9c71db00cbfc26f72253c','boe26-3aa2ef4a8d1992df8b9df022','boe26-fe6672429b2a7d0a49ae0251','boe26-85e9969d8c04adf1effab350','boe26-e5bef0874e3e017f9add8f11','boe26-99074e3b50f1d60021a038e5','boe26-fc6f5e9f304f5f60d2a11cb5','boe26-36e4138c72be86429aae2272','boe26-ce3451403b0d7d67f22416f6','boe26-3de60256716ecea5e29f5c4a','boe26-0b227c89f1c7e5541348d2f2','boe26-2cb66c246a4895d353e4ec98','boe26-04d83242ee469190d05ee7ea','boe26-0d24b22195881af52b387ead','boe26-742f5f74818d82c7844519e7','boe26-5a587861c1f98a93b767ac5c','boe26-b6108658d818f59987de93af','boe26-9478f93e6f8f35623fa557d2','boe26-b11ee59cbaa2d9fc78ee524c','boe26-8be208fff17d158808af48fb','boe26-8bb8e16ea482d84098347e0e','boe26-8bbb88c0a2b5eb25754e2bfe','boe26-b330a1fa85ef6d40a34b1cfd','boe26-e33f04cc8c3d623346fc3ea2','boe26-a4ada0861319e7494dda8ece','boe26-7cceeedb8ee7d7c9a1ed5b8f','boe26-798437cfe8ae0119aca62ac0','boe26-d0018c92331610ff5ba5ca2f','boe26-f9d06471f7ed3984b872f3cc']);
  IF k <> 94 THEN RAISE EXCEPTION 'unit_versions: inserted % of 94', k; END IF; END $c$;
COMMIT;
