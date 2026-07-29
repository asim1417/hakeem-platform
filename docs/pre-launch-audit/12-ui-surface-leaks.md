# مسح الأكواد والرموز والبيانات الظاهرة في الواجهات

**المرجع:** UI-SURFACE-LEAK-SCAN  
**الفرع:** `cursor/pre-launch-audit-ff97`  
**التاريخ:** 2026-07-29  

## الهدف

إزالة أي أكواد مطوّرين، أسرار، رموز داخلية، بيانات تجريبية، أو مصطلحات تقنية غير ضرورية تظهر للمستخدم النهائي في الصفحات والواجهات.

## النتيجة

| الفئة | قبل | بعد |
|---|---|---|
| أسرار/بريد مالك في UI | ظاهرة أو كامنة | أُزيلت من LoginForm وensure-owner |
| كشف OTP في الإنتاج | ممكن | ممنوع تمامًا |
| env / مزوّد / نموذج في الصفحات | ظاهرة | أُخفيت أو عُرّبت |
| رموز Vercel / JSON خام | ظاهرة عند الفشل | رسائل عربية عامة |
| JS-001… أكواد خدمات | ظاهرة | مخفية بـ CSS |
| نموذج القاعة الأصلي (2MB) | عام بمفاتيح API | stub + redirect + noindex |
| health يكشف حالة Clerk/Moyasar | نعم | لا — database + sessions فقط |

## الإصلاحات المنفَّذة (مثبتة)

1. LoginForm: لا بريد مالك، لا magicUrl، لا كلمة ثابتة  
2. `/api/auth/ensure-owner`: رسالة عامة بلا بريد  
3. OTP: `shouldRevealOtp` = false دائمًا في الإنتاج  
4. Legal RAG: لا AI_PROVIDER / OPENAI_API_KEY  
5. Documents landing: لا رابط DOC_SERVICE_URL؛ تخفيف Tesseract/BM25/AES  
6. InteractiveJudge: شارة عربية بلا Claude/Anthropic؛ قطع رابط القاعة القديمة  
7. CaseActions: أخطاء عامة بلا x-vercel-error  
8. AgentConsole: لا dump JSON  
9. AppShell: «مستخدم» بدل «المستخدم التجريبي»  
10. Attachments: بلا ذكر Vercel  
11. CaseBrowser: بلا أوامر CLI / Gemini README  
12. Onboarding: «رمز التحقق» بدل OTP/Clerk  
13. Article detail: حذف أزرار «قريبًا» المعطّلة  
14. Health: بلا حالة تكاملات  
15. `hakim1111.html` → stub آمن  
16. robots: disallow `/original-hakeem/`  
17. أدوار الإدارة بالعربية  

## اختبار

```bash
npx tsx scripts/test-ui-surface-leaks.ts
```

## متبقٍ (مقبول أو قرار منتج)

| البند | لماذا بقي |
|---|---|
| `/developers` و`hk_live_…` | سطح مطوّرين مقصود |
| لوحة `/admin/ai` تذكر sk-ant | أدمن فقط |
| Lab تحت `/dashboard/lab` | موسوم «قيد الاستكشاف» — قرار إخفاء كامل للمنتج |
| عيّنة أحكام في البحث | تنويه عربي أوضح؛ البيانات نفسها قرار بيانات |
| `OWNER_DEFAULT_PASSWORD` في ensure-owner.ts | خادم فقط للتطوير المحلي عند الإنشاء — ليس UI |

## قرار

الواجهات العامة ولوحة المستخدم أصبحت خالية من التسريبات الحرجة الظاهرة. يُنصح بإعادة نشر الفرع ثم مرور بصري سريع على: الرئيسية، الدخول، اسأل حكيم، الوثائق، القاضي، البحث، الإعدادات.
