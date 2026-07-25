# تقرير المرحلة 3A — ربط اسأل حكيم بمحرك الجلسات

**التاريخ:** 2026-07-25  
**الفرع:** `cursor/session-phase3a-ask-e7e2`  
**الحالة:** جاهزة لاختبارك اليدوي · **لم يُدمَج إلى main** · **لم يُنشَر** · **المعاون غير مربوط**

---

## النطاق المنفَّذ

1. ربط «اسأل حكيم» بمحرك الجلسات عبر APIs المرحلة 2.
2. إنشاء الجلسة عند أول رسالة ناجحة (لا صف فارغ).
3. استعادة الرسائل عند فتح الرابط الدائم.
4. استعادة السياق (الوضع، البحث التفصيلي من state/snapshots، الاستشهادات/basis، لقطات المخرج).
5. الروابط الدائمة: `/dashboard/ask/c/[conversationId]`.
6. قائمة جانبية أساسية (جلسة جديدة · قائمة · فتح).
7. `/api/ai/agent-search` **لم يُغيَّر منطقه** — الحفظ بعد اكتمال البث من العميل.
8. لم تُمسّ `systemPrompt` / أوضاع اسأل / أدوات البحث.
9. **غير مضاف:** بحث السجل · أرشفة · تثبيت · تفريع · تصدير.
10. **غير مربوط:** المعاون القضائي.

---

## ما تم فحصه

- `components/ask/HakeemAskWorkspace.tsx`
- `app/api/ai/agent-search/route.ts` (تأكيد عدم التعديل)
- `lib/modules/agents/modes.ts`
- APIs `/api/conversations*`
- الصفحة الرئيسية ask-first و`/dashboard/ask`

---

## ما تم تنفيذه

| مكوّن | الدور |
|-------|------|
| `ask-session-api.ts` | عميل HTTP لـ service=ask |
| `AskSessionSidebar.tsx` | قائمة أساسية + drawer جوال |
| `AskSessionsLayout.tsx` | تخطيط الشريط + المساحة |
| `AskWorkspaceWithSessions.tsx` | غلاف جاهز للصفحات |
| `HakeemAskWorkspace` | تحميل جلسة + `persistAskTurn` بعد البث + `router.replace` |
| `/dashboard/ask` | جلسة جديدة + الشريط |
| `/dashboard/ask/c/[conversationId]` | رابط دائم |
| `DashboardWorkbench` | يستخدم الغلاف في ask-first |
| أنماط CSS | قائمة ~280px · drawer ≤900px |

### تدفق الحفظ

1. المستخدم يرسل السؤال → `POST /api/ai/agent-search` كما هو.
2. بعد اكتمال النتيجة → `persistAskTurn`:
   - بلا `conversationId`: `POST /api/conversations` (أول رسالة).
   - مع معرّف: `POST .../messages` للمستخدم ثم للمساعد.
3. تحديث العنوان إلى `/dashboard/ask/c/{id}`.

### تدفق الاستعادة

1. فتح `/dashboard/ask/c/{id}`.
2. `GET /api/conversations/{id}?service=ask`.
3. إعادة بناء `turns` + `mode` + `detailed` من الرسائل/state.

---

## ما لم يُنفَّذ (عمدًا — 3B لاحقًا)

- بحث الجلسات / تثبيت / أرشفة / حذف من الواجهة / تفريع / تصدير
- ربط المعاون القضائي
- إدارة طول السياق للنموذج (ما زال آخر 8 أزواج كما في اسأل)
- تغيير جودة الإجابة أو الموجهات

---

## الاختبارات

| الأمر | النتيجة |
|-------|---------|
| `npm run test:ask-sessions-3a` | OK |
| `npx tsx scripts/test-ask-first-home.ts` | OK |
| `npx tsx scripts/test-dashboard-workbench.ts` | OK |
| `npm run test:conversation-api-surface` | 17/17 |
| `npx tsc --noEmit` | نظيف |

---

## الملفات المعدّلة/المضافة (أبرزها)

- `components/ask/HakeemAskWorkspace.tsx`
- `components/ask/ask-session-api.ts`
- `components/ask/AskSessionSidebar.tsx`
- `components/ask/AskSessionsLayout.tsx`
- `components/ask/AskWorkspaceWithSessions.tsx`
- `components/dashboard/DashboardWorkbench.tsx`
- `app/dashboard/ask/page.tsx`
- `app/dashboard/ask/c/[conversationId]/page.tsx`
- `app/api/conversations/route.ts` (دعم `statePatch` عند الإنشاء)
- `app/globals.css`
- `scripts/test-ask-sessions-3a.ts` + تحديثات اختبارات ask-first/workbench
- `package.json`

**لم يُعدَّل:** `app/api/ai/agent-search/route.ts` · `lib/modules/agents/modes.ts`

---

## قاعدة البيانات

- لا مهاجرة جديدة في 3A.
- تعتمد على مهاجرة/محرك المرحلة 2.
- الإنتاج: لم يُنشر ولم تُدمَج.

---

## كيف تختبر يدويًا

1. تأكد من تطبيق مخطط المرحلة 2 على قاعدتك.
2. افتح `/dashboard` أو `/dashboard/ask`.
3. اسأل سؤالًا — بعد الإجابة يجب أن يتغيّر المسار إلى `/dashboard/ask/c/...`.
4. حدّث الصفحة — الرسائل والوضع يعودان.
5. افتح قائمة «الجلسات» واختر جلسة أخرى / جلسة جديدة.
6. على عرض ضيق (~390px): زر الجلسات يفتح درجًا ويُغلق بـ Escape/خارج اللوحة.

---

## المخاطر

1. فشل حفظ الجلسة لا يوقف عرض الإجابة (الحفظ بعد البث) — قد تبقى إجابة بلا جلسة إن فشل API.
2. الانتقال من الرئيسية إلى `/dashboard/ask/c/...` بعد أول حفظ يغيّر المسار عمدًا للرابط الدائم.
3. استعادة `basis` تُعلَّم `auto` عند إعادة البناء من المصادر المحفوظة.

---

## القرار المطلوب

بعد اختبارك اليدوي: اعتماد 3A للانتقال إلى **3B** (بحث/تثبيت/أرشفة/… حسب الأولوية) أو طلب تعديلات على 3A أولًا.
