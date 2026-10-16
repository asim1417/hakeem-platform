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
SELECT * FROM (SELECT 'boe26-75f6db2b2c0cebb4aa7acecf' id,'cmpzcv89r0anmvtrkbiu0xkex' unit_id,'1 - يتحمل صاحب العمل رسوم استقدام العامل غير السعودي، ورسوم الإقامة ورخصة العمل وتجديدهما، وما يترتب على تأخير ذلك من غرامات يتسبب بها صاحب العمل، ورسوم تغيير المهنة، والخروج والعودة، وتذكرة عودة العامل إلى موطنه بعد انتهاء العلاقة بين الطرفين
2 - يتحمل العامل تكاليف عودته إلى بلده في حالة عدم صلاحيته للعمل أو إذا رغب في العودة دون سبب مشروع.
3 - يتحمل   صاحب العمل    رسوم نقل خدمات العامل الذي يرغب في نقل خدماته إليه.
4 - يلزم   صاحب العمل    بنفقات تجهيز جثمان العامل ونقله إلى الجهة التي أبرم فيها العقد أو استقدم العامل منها، ما لم يدفن بموافقة ذويه داخل المملكة، ويعفى   صاحب العمل    في حالة التزام المؤسسة العامة للتأمينات الاجتماعية بذلك.' body,'2024-08-12'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) من هذه المادة لتكون بالنص الآتي: "يتحمل صاحب العمل رسوم استقدام العامل غير السعودي، ورسوم الإقامة ورخصة العمل وتجديدهما، وما يترتب على تأخير ذلك من غرامات يتسبب بها صاحب العمل، ورسوم تغيير المهنة، والخروج والعودة، وتذكرة عودة العامل إلى موطنه بعد انتهاء العلاقة بين الطرفين".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'b8beb4e1c5292d0a2e9ed4b5966cd011'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89r0anmvtrkbiu0xkex') = '3d684c23a9d039e17fba514302766e47'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89r0anmvtrkbiu0xkex' AND valid_from='2024-08-12'::timestamptz);

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
SELECT * FROM (SELECT 'boe26-ee9c1bcefe877315e60c0e21' id,'cmpzcv89t0as0vtrkp3lo8o26' unit_id,'يحق  لمفتشي  العمل   :
1- دخول أي منشأة خاضعة لأحكام نظام العمل في أي وقت من أوقات عمل المنشأة دون إشعار سابق
2 - القيام بأي فحص أو تحقيق لازم للتحقق من سلامة تنفيذ النظام، ولهم على الأخص ما يأتي :

أ - سؤال   صاحب العمل    أو من يمثله، أو العمال، على انفراد أو في حضور شهود، عن أي أمر من الأمور المتعلقة بتنفيذ أحكام النظام.
ب - الاطلاع على جميع الدفاتر والسجلات والوثائق الأخرى اللازم الاحتفاظ بها طبقًا لأحكام هذا النظام والقرارات الصادرة بمقتضاه، والحصول على صور ومستخرجات منها.
ج - أخذ عينة أو عينات من المواد المستعملة أو المتداولة في العمليات الصناعية وغيرها الخاضعة للتفتيش، مما يظن أن لها أثرًا ضارًّا على صحة العمال أو سلامتهم، وذلك لغرض تحليلها في المختبرات الحكومية، ولمعرفة مدى هذا الأثر، مع إبلاغ   صاحب العمل  أو ممثله بذلك.' body,'2024-08-12'::timestamptz valid_from,'مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ' ei,'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1' eu,'- صدر المرسوم الملكي رقم (م/44) وتاريخ 1446/2/8هـ، وذلك بالموافقة على تعديلات بعض مواد نظام العمل (ويعمل بها من تاريخ 1446/8/20هـ)

وعدلت الفقرة (1) من هذه المادة لتكون بالنص الآتي: "دخول أي منشأة خاضعة لأحكام نظام العمل في أي وقت من أوقات عمل المنشأة دون إشعار سابق".' eq) v
WHERE md5(concat_ws(chr(31),v.id,v.unit_id,v.body,to_char(v.valid_from AT TIME ZONE 'UTC','YYYY-MM-DD'),coalesce(v.ei,''),coalesce(v.eu,''),coalesce(v.eq,''))) = 'f47ff702d5cd976458a277d4cc9e9ff1'
  AND (SELECT md5(content) FROM legal_articles WHERE id='cmpzcv89t0as0vtrkp3lo8o26') = '8c6e2d96a059491261b247cb5f4d2621'
  AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id='cmpzcv89t0as0vtrkp3lo8o26' AND valid_from='2024-08-12'::timestamptz);

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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-5478f9f99e9ed36516206336','boe26-e609ddbb78ed73718bf6d931','boe26-8ecdd8b80232e0ba8cdd0d78','boe26-064882aa6f8045019eb2b245','boe26-747ad045ce2475ee1f012aa2','boe26-a9c475e660a5eb28fe48b1fb','boe26-75f6db2b2c0cebb4aa7acecf','boe26-9b02dbce2a3ad12600d5349c','boe26-f68a76088b3711c8bbef7b0a','boe26-eb4646a559be12b6c5482bd3','boe26-ee9c1bcefe877315e60c0e21','boe26-a638f3928c75025024ad5cce','boe26-69309af58125c3edfc3402b9']); IF k <> 13 THEN RAISE EXCEPTION 'unit_versions chunk 1: % of 13', k; END IF; END $c$;