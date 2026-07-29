# 08 — قائمة تحقق الإطلاق | PRE-LAUNCH-AUDIT-001

## قبل الإطلاق

- [ ] دمج/نشر فرع `cursor/pre-launch-audit-ff97`
- [ ] `npm run typecheck` و`npm run build` على CI أخضر
- [ ] `npx tsx scripts/test-pre-launch-security.ts` أخضر
- [ ] نسخة احتياطية Neon + تجربة استعادة
- [ ] تطبيق migrations الحصّة/النقاط على الإنتاج
- [ ] `AUTH_SECRET` قوي وفريد
- [ ] لا `ALLOW_UNAUTHENTICATED_GUEST`
- [ ] Clerk production keys + DNS/callbacks لـ hakeemsa.com
- [ ] Google OAuth redirect: `https://hakeemsa.com/api/auth/callback/google` (+ www إن لزم)
- [ ] `ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic`
- [ ] تدوير كلمة المالك إن لزم (`OWNER_FORCE_PASSWORD_RESET` لمرة)
- [ ] `OWNER_EMERGENCY_*` مغلق
- [ ] سياسة الخصوصية/الشروط منشورة (بعد دمج الفرع)
- [ ] robots المحدّث منشور
- [ ] إخفاء/تعطيل Lab إن رُفض للإطلاق العام
- [ ] مراقبة أخطاء Vercel + تنبيه
- [ ] تحديد مسؤول قرار الإطلاق

## أثناء الإطلاق

- [ ] نشر الإنتاج
- [ ] `/` و`/api/health` = 200 و`ok:true`
- [ ] تسجيل دخول Google → `/auth/continue` → لوحة بلا وميض فشل
- [ ] إنشاء سؤال في اسأل حكيم وحفظ الجلسة
- [ ] تحديث الصفحة واستعادة الجلسة
- [ ] رفع مرفق صغير مسموح
- [ ] رفض مرفق > الحد
- [ ] مستخدم عادي لا يدخل `/admin`
- [ ] مراقبة السجلات 15–30 دقيقة

## بعد الإطلاق

- [ ] Smoke كامل (دخول/خروج/Ask/حصّة/مرفقات)
- [ ] مراجعة فشل تسجيل الدخول
- [ ] مراجعة استهلاك Anthropic والحصّة
- [ ] لا أخطاء 5xx متصاعدة
- [ ] التأكد من عدم فهرسة `/dashboard` و`/admin`
