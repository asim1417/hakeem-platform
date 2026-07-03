# دليل أصول لعبة نجوم البلنتيات

اللعبة تعمل الآن بأصول شبه واقعية مولّدة داخليًا. هذا الدليل لاستبدالها
بصور وأصوات حقيقية عالية الجودة عند الرغبة.

## سير العمل

1. **الجلب أثناء التطوير فقط** — لا تحميل أثناء لعب الطفل:
   ```bash
   cp .env.example .env   # وضع مفاتيح Pexels/Pixabay
   npm run fetch:assets   # ينزّل مرشحات إلى public/assets/ للمراجعة
   ```
2. راجع الصور يدويًا واختر الأنسب، وسجّل كل أصل معتمد في `ATTRIBUTIONS.md`.
3. عالج الصور للمقاسات أدناه ثم انسخها **بالأسماء النهائية** إلى `src/assets/images/`.
4. `npm run build` — الأصول تُضمّن داخل ملف اللعبة الواحد (لا تحميل شبكي وقت اللعب).

## صور الملاعب

ابحث في Pexels أو Pixabay عن:
- soccer stadium field goal
- football stadium penalty kick
- soccer goal stadium grass
- football field night lights

المقاس النهائي: **720×1200 طولي** (تُقص من الصور العريضة)، JPEG جودة ~72، ≤150KB.
الأسماء: `stadium-real.jpg`, `stadium-school.jpg`, `stadium-street.jpg`, `stadium-stars.jpg`, `stadium-cup.jpg`.

## صور الكرة

ابحث عن: soccer ball grass / football ball stadium / soccer ball close up.
قصّ الكرة إلى **PNG شفاف 256×256**.
الأسماء: `ball-real.png`, `ball-stars.png`, `ball-fire.png`, `ball-bolt.png`, `ball-gold.png`.

## الحارس

ابحث عن: goalkeeper diving save / soccer goalkeeper action.
يفضل PNG شفاف أو sprite sheet بوضعيتين على الأقل (استعداد/ارتماء).
المفاتيح الحالية في الكود: `keeper`, `keeper-dive`, `keeper-iron`, `keeper-iron-dive`
— لاستبدالها حمّل الصور بهذه المفاتيح في `BootScene.preload`.

## الأصوات

ابحث في Pixabay عن:
- soccer kick sound effect
- goal cheer crowd sound effect
- goalkeeper save sound effect
- cute button click sound
- trophy win sound effect
- reward unlock sound effect

الصيغة: mp3 أحادي ≤64kbps. الاستبدال في `src/utils/audio.ts` (المؤثرات)
و`src/assets/audio/` (صوت المعلق — بنفس أسماء الملفات).

## الأيقونات

- Game-icons.net للأيقونات الرياضية (كأس/صافرة/قفاز/حذاء) — CC BY: سجّل النسبة.
- Font Awesome Free لأيقونات الواجهة.
- Kenney لعناصر الواجهة والأزرار (CC0).

## الخط العربي

الواجهة تستخدم خط النظام حاليًا. لاستخدام **Cairo**:
نزّل `Cairo-Bold.woff2` من Google Fonts إلى `src/assets/fonts/`،
أضف `@font-face` في `src/styles.css`، وغيّر `FONT` في `gameConfig.ts` إلى `'Cairo, Arial, sans-serif'`.
(لا تربط CDN — الخط يجب أن يُضمّن في البناء).

## ملاحظة الترخيص

قبل استخدام أي أصل، سجّل بياناته في `ATTRIBUTIONS.md` — لا تستخدم أصلًا غير واضح الترخيص.
