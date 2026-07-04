# 16 — مراجعة الكود والهندسة

## ما هو جيد فعلًا
- **فصل بيانات نظيف**: players/phrases/assetsManifest/gameConfig — كل قيم اللعب في مكان واحد قابل للموازنة.
- **فصل الخدمات**: audio/announcer/progress/ui/animations وحدات مستقلة بواجهات صغيرة.
- **Type safety صارم**: صفر `any`، صفر أخطاء بناء، أنواع دقيقة (DifficultyKey/StageDef/Outcome...).
- **التسمية**: عربية بالتعليقات + إنجليزية بالرموز — متسقة.
- نظام الحفظ (progress.ts): مغلف localStorage آمن مع try/catch وقيم افتراضية.

## المشاكل الهيكلية (بالأولوية)

| # | المشكلة | الموقع | الأثر | الحل |
|---|---|---|---|---|
| 1 | **GameScene god-file (~650 سطر، ٤ مسؤوليات)**: تسديد + حارس + مدير مباراة + إعادة + مدرب + HUD | GameScene.ts | كل ميزة جديدة (فاولات/دفاع) ستضاعف التعقيد وتزيد مخاطر الكسر | تفكيك إلى: `ShotController` (سحب/سهم/إطلاق)، `KeeperAI` (idle/dive/حالات)، `MatchDirector` (أدوار/خصم/ذهبية)، `ReplaySystem`، `GameHud` — كصفوف تُحقن بالمشهد لا مشاهد جديدة |
| 2 | **تكرار رسم الخلفية** (صورة+طبقة+fallback) في ٤ مشاهد | Menu/Select/Result/Locker | تعديل الخلفية = ٤ أماكن | دالة `drawStadiumBackdrop(scene, key, dim)` في utils |
| 3 | **حالة اللعبة سلاسل حرة** (`'aiming'|'shooting'|'resolved'` + أعلام golden/mode) | GameScene | مقبولة الآن؛ ستتشعب مع وضع الدفاع | ترقية لآلة حالة صريحة عند بناء وضع الدفاع (كائن انتقالات بسيط يكفي — لا حاجة لمكتبة XState لهذا الحجم) |
| 4 | أرقام سحرية للمواضع (y=428, 552...) داخل المشاهد | كل المشاهد | إعادة التخطيط شاقة | كائن `LAYOUT` في gameConfig للثوابت المشتركة (اختياري، P3) |
| 5 | مؤقتات متداخلة في resolve/opponentTurn (delayedCall متسلسلة) | GameScene | صعبة التتبع عند إلغاء (خروج للقائمة أثناء تسلسل) — **خلل كامن**: الخروج للرئيسية منتصف دور الخصم قد يطلق scene.start على مشهد ميت | تجميع المؤقتات وإلغاؤها في `shutdown()` للمشهد — **أول إصلاح كود عند استئناف التطوير** |
| 6 | لا اختبارات آلية للمنطق | — | التوازن (goals/pass) يُختبر يدويًا فقط | فصل منطق الحسم الصافي (دوال نقية: هل هدف؟ نتيجة الدور؟) واختباره بـVitest — يصبح ممكنًا بعد التفكيك (1) |

## البنية المستهدفة المقترحة (تدريجية — لا إعادة كتابة)
```
src/game/
├── ShotController.ts    الإدخال والسهم والإطلاق (من GameScene)
├── KeeperAI.ts          الحالات والتنبؤ والارتماء
├── MatchDirector.ts     البطولة/المباراة/الذهبية/النتائج
├── ReplaySystem.ts      تسجيل المسار والإعادة
├── CameraDirector.ts    زوم الهدف/الانتقالات (جديد — انظر 14)
└── GameHud.ts           اللوحة والنجوم والعبارات والمدرب
```
`GameScene` يبقى منسقًا رفيعًا (~150 سطر) يركّب هذه الوحدات. الترتيب الآمن: استخراج KeeperAI أولًا (أقل تشابكًا)، ثم ShotController، ثم MatchDirector.

## أنظمة موجودة تعادل الـManagers المقترحة بالمواصفة
AudioManager=audio.ts ✅ | RewardManager=progress.ts ✅ | AssetManager=assetsManifest+BootScene ✅ | InputManager=داخل ShotController المقترح | UIManager=ui.ts ✅ | TournamentManager=داخل MatchDirector المقترح | CameraManager=غير موجود حاليًا (مقترح أعلاه).
