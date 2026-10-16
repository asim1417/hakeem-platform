DO $g$ BEGIN
  IF (SELECT md5(content) FROM legal_articles WHERE "lawName" LIKE 'نظام التنفيذ%' AND "articleNumber"=1 LIMIT 1) <> '0c1443e1dcdf68c655856daa5d4188b5'
  OR (SELECT md5(content) FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=1 LIMIT 1) <> 'bb195018b612438b9d03d9c2b2ef80c4'
  THEN RAISE EXCEPTION 'guard md5 changed'; END IF; END $g$;
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

DO $c$ DECLARE k int; BEGIN SELECT count(*) INTO k FROM unit_version WHERE id = ANY(ARRAY['boe26-6fd9c3d5cbcbeeeb13b5b0d0','boe26-e7e6f1402eddf7d9d3df5e22','boe26-8aa064f147ec0f493950fec9','boe26-991fbb6748b62d7b4d605625','boe26-4f3c3845cbbfd3f96cd48e75','boe26-28862e7a5377d7b656ba1beb','boe26-6743f21864ae6b5a0653fb58','boe26-bed544611fbd7110f26ad712','boe26-d04753e5dc7991f9f5cf9f2d','boe26-0834d509422efac0b0688d40','boe26-b40d6a5ffac2989299a13ea4','boe26-46ac42cc96215c6236bb66ae']); IF k <> 12 THEN RAISE EXCEPTION 'unit_versions chunk 2: % of 12', k; END IF; END $c$;