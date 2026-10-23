# واجهات API وMCP — HKM-031

**القياس:** 2026-10-18T11:44Z للكشف الحي، ومسح ملفات `app` على `main@d4ee69a`.

## الجرد

258 معالج HTTP في 192 ملف مسار. التوزيع الظاهر: GET 114، POST 105، PATCH 8، DELETE 13، PUT 4، OPTIONS 14. الملف [API_CATALOG.csv](API_CATALOG.csv).

ماسح آلي وسم 98 معالجًا بأن المصادقة غير ظاهرة، بينهم مسارات إدارة. المراجعة الذاتية قرأت ثلاثة ملفات موسومة خطأً ووجدت `requireApiPermission`:

- `app/api/admin/users/[id]/route.ts` → `USERS_MANAGE`
- `app/api/admin/api-keys/[id]/route.ts` → `USERS_MANAGE`
- `app/api/legal-core/principles/[id]/route.ts` → `LEGAL_CORE_EDIT` ثم 409 إذا كان المكتب حيًا

لذلك عمود `auth_scan=SCAN_INCONCLUSIVE` يعني قصور الماسح، لا ثغرة مؤكدة. لم يُعلَن عدد المسارات العامة من هذا الماسح.

الكشف الحي:

| المسار | النتيجة |
|---|---|
| `/api/health` | 200، `ok`، قاعدة `up`، Clerk متطابق، Moyasar غير مهيأ، زمن 161ms |
| `/mcp` بلا رمز | 401، `scope=mcp:read` |
| `/admin/legal` | 307 إلى تسجيل الدخول |
| `/dashboard/legal-core` | 307 إلى تسجيل الدخول |
| `/legal` | 200 و`dir=rtl` |

## MCP

الأدوات في [MCP_TOOLS_CATALOG.csv](MCP_TOOLS_CATALOG.csv): ثلاث عشرة أداة `hakeem_*` في `app/mcp/route.ts` وثلاث `aman_*` في `lib/mcp/aman-server.ts`. المسار `runtime=nodejs` ولا يضبط `maxDuration`. مسارات المساعد والوكيل تضبط 300 ثانية، وهذا سقف منصة شائع لمهلة تاريخية، وليس سببًا مثبتًا.

`ROOT_CAUSE_UNPROVEN` لمهلات 300 ثانية المذكورة في مرجع 18 أكتوبر: لا سجل Vercel في هذه الجلسة، والطلب غير المصادق انتهى فورًا. تجمع الأخطاء القديم لا يُعاد كسبب جذري.

مؤقت الأداة في `lib/mcp/tool-runner.ts` هو `MCP_TOOL_TIMEOUT_MS`، والافتراضي **20 ثانية**، ويرفض بوسم `MCP_TOOL_TIMEOUT`. هذا المؤقت لا يفسّر قتلًا عند 300 ثانية: المهلة الأطول تقع خارج الأداة (المصادقة، أو انتظار اتصال Prisma، أو سقف الدالة). لا مجمع اتصالات خاصًا بـ MCP داخل `lib/mcp`. البوابة في `app/mcp/route.ts` مغلقة افتراضيًا (503) إن غاب المفتاح وسر التصاريح، ما لم يُفتح `HAKEEM_MCP_ALLOW_OPEN=1`. الرد الحي `401` لا `503`، فوضع الإنتاج وقت الفحص هو المصادقة لا الإغلاق.

`/aman/mcp` بلا `withMcpAuth` عن قصد: ثلاث أدوات فرز (`aman_triage_case` و`aman_render_service_card` و`aman_get_consultation_link`) تقبل تصنيفات عامة فقط وتعيد بطاقة أو رابطًا منشورًا، ولا تكتب قاعدة. مسار البحث `/mcp` يبقى مستقلًا.

تجمع الاتصالات: الحادثة التاريخية لانتهاء مهلة OAuth لم تُعد. `max_connections` الظاهر 901 على هذا الحساب، والجلسات المرئية وقت الجرد 14. هذا لا يفسر حادثة 16 أكتوبر.

## ما لم يُنفذ

لا استدعاء أداة MCP مصادَق، ولا قياس زمن بحث، ولا تتبع استعلام بطيء. `pg_stat_statements` غير موجود.
