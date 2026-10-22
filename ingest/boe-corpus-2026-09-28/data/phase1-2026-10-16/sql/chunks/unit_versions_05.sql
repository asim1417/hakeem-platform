DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-856e3f3d072e8fc8d628a5f2','boe26-f1d8f640be5c5160d7eaeb84','boe26-c0b900a744b56667a2bce71f','boe26-62ae68895dd22294b26daae6','boe26-7d79e1aeb3cc7b04fc022276','boe26-ef76f8e273ad00ce9c55e136','boe26-1c07783de2765ed2302e0cbc','boe26-ba0ad77c6a9af665cb58d595','boe26-d869dfa7485eb1d399948fd0','boe26-e4aba3da99f4eed840dd70a6','boe26-b36f442deb45cf0cdf0df841']); IF k <> 11 THEN RAISE EXCEPTION 'unit_versions chunk 5: % of 11', k; END IF; END $c$;