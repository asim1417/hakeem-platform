DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-3de60256716ecea5e29f5c4a','boe26-0b227c89f1c7e5541348d2f2','boe26-2cb66c246a4895d353e4ec98','boe26-04d83242ee469190d05ee7ea','boe26-0d24b22195881af52b387ead','boe26-742f5f74818d82c7844519e7','boe26-5a587861c1f98a93b767ac5c','boe26-b6108658d818f59987de93af','boe26-9478f93e6f8f35623fa557d2','boe26-b11ee59cbaa2d9fc78ee524c','boe26-8be208fff17d158808af48fb','boe26-8bb8e16ea482d84098347e0e']); IF k <> 12 THEN RAISE EXCEPTION 'unit_versions chunk 7: % of 12', k; END IF; END $c$;