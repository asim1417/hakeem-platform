# دليل تثبيت جسر رصد حكيم المحلي

## ماذا يفعل؟

يشغّل جلب BOE / NCAR / UQN من جهازك داخل السعودية، بينما تدير المهام من لوحة حكيم. بعد الاقتران الأول لا تحتاج Terminal يوميًا.

## المتطلبات

- Windows 10/11 أو macOS حديث أو Ubuntu LTS
- Node.js 20+
- اتصال إنترنت صادر (HTTPS) — **لا منافذ واردة**

## التثبيت التقني الأولي (ليس حزمة مستخدم نهائي موقّعة)

> الحزم الموقّعة رقميًا للمستخدم النهائي تُوفَّر لاحقًا عند توفر الشهادات. لا تُوصف هذه الخطوات بأنها منتج نهائي للمستهلك.

```bash
git clone <repo>
cd hakeem-platform/packages/rasd-local-agent
npx tsx src/cli.ts pair --cloud https://YOUR_HAKEEM_HOST --code ABCD-EFGH
npx tsx src/cli.ts run
```

افتح `http://127.0.0.1:8788` لواجهة الحالة المحلية.

### Windows Service (اختياري)

استخدم Task Scheduler أو NSSM لتشغيل `npx tsx src/cli.ts run` عند تسجيل الدخول. Uninstaller = حذف المهمة + مجلد `%USERPROFILE%\.hakeem-rasd-agent`.

### macOS LaunchAgent (اختياري)

انظر `launchd/com.hakeem.rasd-agent.plist.example`.

### Linux systemd

انظر `systemd/hakeem-rasd-agent.service`.

## الاقتران من لوحة حكيم

1. `/admin/rasd/agents` → «إضافة جهاز رصد داخل السعودية»
2. انسخ الرمز (≤ 10 دقائق)
3. أدخله في الوكيل مرة واحدة
4. يظهر الجهاز Online

## الخصوصية

قبل الاقتران يعرض الوكيل/اللوحة أن البيانات المرسلة تقتصر على: صحة التشغيل، نتائج المصادر الرسمية، إصدار الوكيل، سجلات أمنية ضرورية — بلا ملفات المستخدم أو سجل التصفح.

## إلغاء الاقتران

من اللوحة: سحب صلاحية / حذف بعد تأكيد. احذف محليًا مجلد `~/.hakeem-rasd-agent`.
