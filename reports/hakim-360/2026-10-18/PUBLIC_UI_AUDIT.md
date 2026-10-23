# الواجهة العامة — HKM-031

فحص HTTP بلا متصفح مسجّل. `dir=rtl` و`lang=ar` ظاهران في HTML الصفحة الرئيسية و`/legal`.

| الفحص | النتيجة |
|---|---|
| `https://hakeemai.net/` | 200، Cloudflare، HSTS، CSP موجودة، `x-vercel-cache: MISS` |
| `/legal` | 200، `x-matched-path: /legal` |
| `/robots.txt` | 200. `Host` و`Sitemap` يشيران إلى `https://hakeem-platform.vercel.app` |
| `/sitemap.xml` | 200، 1,078 وسم `loc` على المضيف `hakeem-platform.vercel.app` |
| `https://www.hakeemai.net/` | لا يُحل الاسم |
| صفحات الإدارة | تحويل إلى `/sign-in` |

CSP يسمح `unsafe-inline` و`unsafe-eval` في السكربت، ويذكر نطاقات Clerk و`https://hakeem-platform.vercel.app` في `connect-src`. هذا وصف للترويسة الحية لا حكم اختراق.

لم تُفتح مادة، ولا تُبدّل تاريخ سريان، ولا تُختبر لوحة بعد الدخول. رحلة المستخدم تبقى HKM-010. شارة التنفيذ في 28 أكتوبر 2026 موثقة في HKM-024 ولم تُعد مشاهدتها هنا.

فرق المضيف بين الدومين العام وخريطة الموقع هو H360-008. نجاح الصفحة 200 لا يعني أن الفهرس يعلن الدومين نفسه.
