# خطة الترقية إلى لعبة إنتاجية

## المرحلة الحالية

Static PWA Prototype.

مناسبة لـ:
- إثبات الهوية.
- اختبار تجربة المستخدم.
- إعطاء المبرمج أساسًا واضحًا.
- تشغيل سريع بدون أخطاء تثبيت.

## المرحلة 1 — Prototype Plus

مدة مقترحة: 1–2 أسبوع.

- إضافة حارس مرمى.
- إضافة شاشة تدريب كاملة.
- إضافة شجرة مهارات.
- تحسين AI.
- إضافة مؤثرات صوتية أصلية.
- إضافة إعداد صعوبة.
- إضافة save slots.

## المرحلة 2 — Production Web

تقنية مقترحة:

- Vite + TypeScript.
- React للواجهات.
- Zustand للحالة.
- Phaser أو PixiJS للعبة 2D.
- Vitest للاختبارات.
- Playwright لاختبار الواجهة.

## المرحلة 3 — Mobile Native

الخيار الأول للأطفال والجوال:

- Unity 6.
- C#.
- UI Toolkit أو Canvas.
- Addressables للأصول.
- Firebase/Supabase/Custom Backend للحسابات.

الخيار الثاني:

- Godot 4.
- GDScript/C#.
- مناسب وخفيف ومفتوح المصدر.

## المرحلة 4 — Online Services

- Auth + parental safety.
- Inventory.
- Store.
- Missions.
- Leaderboard.
- Clubs.
- Friend system.
- Safe chat.
- Live events.

## توصية المنتج

لا تبدأ 3D كامل قبل تثبيت المتعة الأساسية في 2D/2.5D. البداية الصحيحة:

```text
Fun Core Loop → UI Polish → Progression → Content → Online → 3D Upgrade
```
