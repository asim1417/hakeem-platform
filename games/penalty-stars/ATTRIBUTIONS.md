# ATTRIBUTIONS — توثيق رخص الأصول

كل أصل خارجي يُستخدم في اللعبة يجب تسجيله هنا **قبل** اعتماده،
خاصة ما يتطلب ذكر المصدر (attribution).

## الأصول الحالية

جميع الأصول الحالية **مولّدة داخل المشروع** ولا تتطلب أي نسبة خارجية:

| Asset | Source | Author | License | URL | Notes |
|---|---|---|---|---|---|
| stadium-*.jpg (٥ ملاعب) | مولّدة برمجيًا | scripts/generate-assets.py (Pillow) | ملك المشروع | — | شبه واقعية، قابلة للاستبدال |
| ball-*.png (٥ كرات) | مولّدة برمجيًا | scripts/generate-assets.py (Pillow) | ملك المشروع | — | تظليل كروي |
| keeper / star / avatars المرسومة | مولّدة برمجيًا | BootScene (Phaser Graphics) | ملك المشروع | — | |
| cheer-*.mp3 / call-*.mp3 (صوت المعلق) | مولّدة برمجيًا | scripts/generate-voice.py (espeak-ng GPLv3 كأداة) | ناتج التوليد ملك المشروع | https://github.com/espeak-ng/espeak-ng | الأداة GPL، المخرجات غير مقيدة |
| المؤثرات الصوتية (kick/goal/…) | مولّدة برمجيًا | src/utils/audio.ts (توليف WAV) | ملك المشروع | — | |
| صور الأطفال (players/*.png) | العائلة | ولي الأمر | استخدام عائلي بإذن المالك | — | خاصة — لا تُعاد في مشاريع أخرى |
| stadium-real.jpg و ball-real.png | حزمة الهوية البصرية (مقدمة من المالك) | مالك المشروع | هوية أصلية — بلا عناصر FIFA/EA محمية | — | معالجة ومحاذاة داخل المشروع |
| ألوان الواجهة (gold/navy/lime/cyan) | design_tokens.json من حزمة الهوية | مالك المشروع | ملك المشروع | — | |

## عند إضافة أصول خارجية (Pexels / Pixabay / Kenney / OpenGameArt / Game-icons)

أضف صفًا لكل أصل:

| Asset | Source | Author | License | URL | Notes |
|---|---|---|---|---|---|
| (مثال) stadium-real.jpg | Pexels | اسم المصوِّر | Pexels License | رابط الصورة | لا يتطلب نسبة لكن يُفضَّل |

- **Pexels/Pixabay**: مجانية للاستخدام التجاري دون نسبة، يُمنع إعادة بيع الأصل كما هو.
- **Kenney**: CC0 — بلا قيود.
- **OpenGameArt**: تختلف الرخصة لكل أصل — سجّلها بدقة (CC0/CC-BY/GPL).
- **Game-icons.net**: CC BY 3.0 — **يتطلب ذكر المؤلف هنا**.
- **Font Awesome Free**: CC BY 4.0 للأيقونات — يتطلب النسبة.
- **خط Cairo (Google Fonts)**: SIL OFL 1.1 — حر مع إبقاء ترخيص الخط.
