DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-8bbb88c0a2b5eb25754e2bfe','boe26-b330a1fa85ef6d40a34b1cfd','boe26-e33f04cc8c3d623346fc3ea2','boe26-a4ada0861319e7494dda8ece','boe26-7cceeedb8ee7d7c9a1ed5b8f','boe26-798437cfe8ae0119aca62ac0','boe26-d0018c92331610ff5ba5ca2f','boe26-f9d06471f7ed3984b872f3cc']); IF k <> 8 THEN RAISE EXCEPTION 'unit_versions chunk 8: % of 8', k; END IF; END $c$;