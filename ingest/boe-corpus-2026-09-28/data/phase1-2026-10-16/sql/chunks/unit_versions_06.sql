DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-f56f54750f83666089aadeca','boe26-fc03e3c4ce7f437a13cac36a','boe26-0a7435d352cad485803071d3','boe26-4a1cbdf52910dec77e60e472','boe26-dfb9c71db00cbfc26f72253c','boe26-3aa2ef4a8d1992df8b9df022','boe26-fe6672429b2a7d0a49ae0251','boe26-85e9969d8c04adf1effab350','boe26-e5bef0874e3e017f9add8f11','boe26-99074e3b50f1d60021a038e5','boe26-fc6f5e9f304f5f60d2a11cb5','boe26-36e4138c72be86429aae2272','boe26-ce3451403b0d7d67f22416f6']); IF k <> 13 THEN RAISE EXCEPTION 'unit_versions chunk 6: % of 13', k; END IF; END $c$;