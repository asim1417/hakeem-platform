DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-9a479551c98176be1cfa0007','boe26-77f32ed9e8589bc56be77607','boe26-47b652da6facdd6ca358856e','boe26-fc1b3dc2223c9fdb4ace440b','boe26-5bd8b35419f876c99c353dd9','boe26-102bba11fe6921f1cc595692','boe26-0350286f2b215f172b690d64','boe26-54ff066de35c2a05aeb46f31','boe26-9fee71979a9701f14e145e08','boe26-d84e0fb48248e65227661d9a','boe26-c4d26882ba729e893c5198ff','boe26-b7070a6b4e5d142d5b20225b']); IF k <> 12 THEN RAISE EXCEPTION 'unit_versions chunk 4: % of 12', k; END IF; END $c$;